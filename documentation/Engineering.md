# ChapterMate — Engineering Notes

> Scope: this document is about **how the machine is built**, not about the product.
> The three engineering pillars are **PDF intake**, **PDF segmentation/storage** and
> **Vapi voice orchestration + retrieval**. Everything else is scaffolding around them.

---

## 1. Engineering thesis

ChapterMate is a *retrieval-grounded voice agent over a user-supplied PDF*. The hard
engineering problems are therefore:

1. **Getting text out of an arbitrary PDF without a backend worker.** Parsing runs in
   the browser (`pdfjs-dist`), the server only ever sees the resulting segments.
2. **Making a 300-page book searchable without a vector database.** A PDF is fanned into
   overlapping word-window segments stored as documents in MongoDB, indexed for `$text`
   search, with a deterministic keyword-regex fallback.
3. **Letting a third-party voice platform query private data safely.** Vapi is the *caller*
   of an authenticated HTTP endpoint; ownership and access are re-checked on every single
   tool call rather than trusted from the assistant's prompt.

Design invariants that hold everywhere in the codebase:

| Invariant | Where it is enforced |
| --- | --- |
| The client never supplies `clerkId` | `createBook`, `saveBookSegments`, `startVoiceSession`, `deleteBook` resolve it from `auth()` |
| Unreadable documents are never *loaded* | `bookAccessFilter()` is spread into the Mongo query, not applied after the fact |
| Slug uniqueness is global, ownership is not | `Book.slug` unique index + `alreadyExists` response (no document echo) |
| A PDF is idempotent to re-upload | `saveBookSegments` deletes prior segments before insert |
| Guests can only touch sample books | `SAMPLE_BOOKS_CLERK_ID = "sample-books"` resolves the same access path for everyone |

---

## 2. System topology

```
                                  ┌──────────────────────────────────────────┐
                                  │            Browser (React 19)            │
                                  │  UploadForm · VapiControls · useVapi     │
                                  │  pdfjs-dist ── parse PDF ──► segments    │
                                  └───────┬───────────────────────┬──────────┘
                                server    │                       │  WebRTC / WS
                                actions   │                       ▼
                                          │            ┌────────────────────────┐
              ┌───────────────────────────┼────────────┤        Vapi cloud       │
              │                           │            │  ASR · LLM · 11Labs TTS │
              │                           │            └───────────┬────────────┘
              ▼                           ▼                        │ HTTPS tool call
   ┌───────────────────┐      ┌─────────────────────┐              │ (searchBook)
   │  Vercel Blob       │      │  Next.js 16 server  │◄─────────────┘
   │  *.pdf, *-cover    │◄─────┤  Route handlers     │
   └───────────────────┘  put │  Server actions     │
                               └──────┬──────┬───────┘
                                      │      │
                       Mongoose conn  │      │  Clerk SDK (auth())
                                      ▼      ▼
                          ┌──────────────┐  ┌───────────┐
                          │ MongoDB Atlas│  │   Clerk   │
                          │ books        │  │ identity  │
                          │ booksegments │  └───────────┘
                          │ voicesessions│
                          └──────────────┘
```

Legend: full lines = request/response the app initiates; the arrow from Vapi into
`/api/vapi/search-book` is the **only inbound path** a third party has into the data layer,
and it is Clerk-authenticated.

---

## 3. Request map

| Route | Kind | Auth | Purpose |
| --- | --- | --- | --- |
| `/` | Server component | public | Marketing landing page |
| `/books` | Server component | public | Sample books (+ own books when signed in). `FF_DUMMY_BOOKS` switches bundled data ↔ database |
| `/books/add` | Server component | **protected** | Upload form; renders `AddBookLimitNotice` when the owner holds `USER_MAX_BOOK` (10) books |
| `/books/session/[slug]` | Server component | public by path, authorised in-page | Renders `VapiControls`; redirects to `/books` when `getBookForSession` denies access |
| `POST /api/upload` | Route handler | Clerk (`auth()` inside `onBeforeGenerateToken`) | Issues Vercel Blob client token for the **PDF** (≤10 MB, `application/pdf`) |
| `POST /api/upload/cover` | Route handler | Clerk | Issues Vercel Blob client token for the **cover** (≤1 MB, jpeg/png/webp) |
| `POST /api/vapi/search-book` | Route handler | Clerk session (may be `null` = guest) | The `searchBook` tool Vapi calls during a live conversation |

Feature flags are read **server-side only** (`lib/feature-flags.ts` uses non-`NEXT_PUBLIC_`
variables) and passed down as props, so the client bundle never decides access.

---

## 4. PDF intake — parsing happens in the browser

The single most deliberate engineering choice in the upload path: **no PDF ever reaches the
server as a stream**. `parsePDFFile()` (`lib/utils.ts`) runs `pdfjs-dist` in the client, so the
Next.js runtime never pays for a parser, a worker or a large file buffer, and the model of
"parse once, store only derived data" keeps the server stateless.

```
 UploadForm.submit(data)                                   ┌──── browser ────┐
        │                                                   │  pdfjs-dist     │
        │ 1. checkBookExist(title)        ─ server action ─► │  worker.min.mjs │
        │      ↳ exists? abort (duplicate title is a FAILURE)└─────────────────┘
        │
        │ 2. parsePDFFile(data.pdfFile) ─────────────────────┐
        │      ├─ arrayBuffer = file.arrayBuffer()           │
        │      ├─ pdfDocument = getDocument(...).promise     │  step 2 costs only
        │      ├─ page 1 → canvas @ scale 2 → JPEG q0.8      │  CPU, never network
        │      ├─ ∀ page: getTextContent().items[].str       │
        │      │            .join(' ') + "\n"                │
        │      └─ splitIntoSegments(fullText) → TextSegment[] │
        │      ↳ segments.length === 0 ? abort (scanned PDF) ─┘
        │
        │ 3. upload("<slug>", pdfFile) ──► POST /api/upload
        │      └─ handleUpload → onBeforeGenerateToken():
        │             auth() must return a userId        (else 401)
        │             allowedContentTypes: application/pdf
        │             maximumSizeInBytes: 10 MB
        │             addRandomSuffix: true
        │             tokenPayload: { userId }
        │      ↳ browser PUTs the bytes straight to Vercel Blob *bypassing Next.js*
        │
        │ 4. cover: chosen image ──► POST /api/upload/cover
        │      └─ same guard, images only, ≤ 1 MB
        │    else: pdfjs page-1 JPEG ──► POST /api/upload/cover
        │
        │ 5. createBook({ …blob urls… })  ─ server action
        │      ↳ re-checks userId, ownership, slug clash, 10-book limit
        │
        │ 6. saveBookSegments(bookId, parsedPDF.content) ─ server action
        │      ↳ deleteMany → insertMany → update totalSegments
        │
        ▼ 7. toast + 2 s delay → router.push("/books")
```

Why the token-exchange dance in steps 3–4 instead of uploading through a Next.js route?
`handleUpload` only **authorises**; the payload travels client → Blob directly. That means
large PDFs never occupy a serverless function's memory or its (much shorter) body-size limit,
while the `onBeforeGenerateToken` callback is still the place where Clerk identity, MIME type
and max size are enforced server-side.

Notable details:

* **Parsing is the gate, not validation.** `UploadSchema` (Zod) already rejects wrong types and
  oversize files, but `parsedPDF.content.length === 0` is what catches *image-only/scanned PDFs* —
  they validate fine and then simply have no text to index.
* **The cover is generated, not required.** When the user supplies no cover image, page 1 is
  rendered at `scale: 2` to a canvas and exported as `image/jpeg` at quality `0.8`, tuned to stay
  under the 1 MB cover cap while remaining legible.
* **Duplicate titles are hard failures.** `checkBookExist` short-circuits before any upload, the
  unique index on `slug` is the backstop, and `isDuplicateKeyError` (Mongo `E11000`) catches the
  parallel-submit race so the user stays on the form instead of being redirected.


---

## 5. Segmentation — the shape of the searchable corpus

### 5.1 The splitter

`splitIntoSegments(text, segmentSize = 500, overlapSize = 50)` is a **word-window** splitter, not a
character or sentence splitter:

```
words = text.split(/\s+/).filter(Boolean)

start = 0                                          ┌─ 500 words ─┐
while start < words.length:                        │             │
    end   = min(start + 500, words.length)         ▼             ▼
    emit  { text: words[start..end].join(' '),   ────────────────────
            segmentIndex, wordCount }              ←50→ overlap ←→
    if end == words.length: break                  ────────────────
    start = end - 50                                   ▲        ▲
                                                       └ 450 new ┘
```

* **500 words** is the retrieval unit: long enough to carry a scene's context, short enough that
  five of them (~2 500 words) fit comfortably into the assistant's context window.
* **50-word overlap** prevents a sentence (and the idea inside it) from being sliced exactly in
  half and becoming unfindable in *both* segments. Consecutive segments therefore share ~1/10 of
  their content — a deliberate storage-for-recall trade.
* The function is **total and defensive**: `segmentSize <= 0` and `overlapSize >= segmentSize`
  throw, and the loop always terminates because `start` strictly increases whenever `end > start`.
* `segmentIndex` is a 0-based, gapless counter — that is what the `{ bookId, segmentIndex }`
  **unique** index polices, so a partially-written batch cannot silently overwrite another book's
  ordering.

### 5.2 From a PDF page to a segment

Text is accumulated page-by-page, separated by a newline so page boundaries survive into the
segment text:

```ts
for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
  const textContent = await page.getTextContent()
  const pageText = textContent.items
    .filter(item => typeof item === 'object' && item !== null && 'str' in item)
    .map(item => item.str)                    // text runs, in PDF reading order
    .join(' ')
  fullText += pageText + '\n'
}
```

The `.filter(...)` guard matters: `getTextContent().items` is a union of text items and
marked-content items, so blindly mapping `.str` would emit `undefined`. Only items carrying a
`str` survive.

### 5.3 Persisting segments (idempotently)

`saveBookSegments(bookId, content)` accepts **either** a raw string (and segments it) **or** the
`TextSegment[]` produced by `parsePDFFile` — the latter is what the upload form passes, so the
splitting work done in the browser is reused rather than repeated.

```
saveBookSegments(bookId, content)
  │
  ├─ auth() ─────────────────► no userId  ⇒ { success: false }   (no DB connection opened)
  ├─ isValidObjectId(bookId) ─► malformed ⇒ 'Book not found.'
  ├─ connectToDatabase()          (cached Mongoose connection)
  ├─ content empty? ⇒ 'Book content is empty'
  ├─ Book.findOne({ _id, clerkId: userId }, { _id: 1 })
  │        ▲ ownership is INSIDE the query → another user's book is never loaded
  ├─ BookSegment.deleteMany({ bookId })          ← idempotent re-upload / replaced content
  ├─ BookSegment.insertMany(segments.map(...))   ← one document per window
  └─ Book.updateOne({ _id, clerkId }, { totalSegments: n })
```

Two details are worth calling out. First, `deleteMany` happens **before** `insertMany` and is
scoped to `bookId` only (ownership was already proven by the `findOne`), which makes the whole
operation safe to retry. Second, `totalSegments` on the `Book` is a **derived count** written at
the end — a convenience field for the UI, never the source of truth.


---

## 6. Data model — how a book is split across the database

One uploaded PDF becomes **1 `Book` document + N `BookSegment` documents + 1 blob pair**, plus
one `VoiceSession` document per conversation. The split is the whole point: the `Book` row stays
tiny and constant-time to read, while the unbounded text lives in segment rows that only a search
touches.

### 6.1 `books` (`database/models/book.model.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `clerkId` | String | Owner. `"sample-books"` for the seeded public library |
| `title` / `author` | String | ≤ 20 chars each (`BOOK_TITLE_MAX_LENGTH`, `BOOK_AUTHOR_MAX_LENGTH`) |
| `slug` | String | `unique`, lowercased, trimmed; derived from `title` via `generateSlug()` |
| `persona` | String | Canonical voice key (`dave` / `daniel` / `chris` / `rachel` / `sarah`); resolved defensively by `getVoiceKey()` |
| `fileURL` / `fileBlobKey` | String | Vercel Blob URL + object key of the PDF |
| `coverURL` / `coverBlobKey` | String | Blob URL + object key of the cover |
| `fileSize` | Number | Bytes, for display/limits |
| `totalSegments` | Number | Derived count, `0` until `saveBookSegments` finishes |
| `createdAt` / `updatedAt` | Date | `{ timestamps: true }` |

`generateSlug()` strips the extension, lowercases, drops non-`[\w\s-]` characters and collapses
spaces/underscores to `-`. Because `slug` is a **global** unique index, two users cannot hold the
same title — which is why `createBook` answers with `{ success: true, alreadyExists: true }` rather
than echoing the colliding document (that document may belong to somebody else).

### 6.2 `booksegments` (`database/models/book-segment.model.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `clerkId` | String | Denormalised owner, so a segment carries its own access metadata |
| `bookId` | ObjectId → `Book` | `index: true` |
| `content` | String | A ~500-word window (`segment.text`) |
| `segmentIndex` | Number | `index: true`; gapless 0-based order |
| `pageNumber` | Number | `index: true`, **optional / currently unpopulated** by the upload path — reserved for page-anchored citations |
| `wordCount` | Number | Number of words in the window |
| `createdAt` / `updatedAt` | Date | `{ timestamps: true }` |

Indexes (the retrieval contract):

```js
BookSegmentSchema.index({ bookId: 1, segmentIndex: 1 }, { unique: true }) // ordering + idempotency
BookSegmentSchema.index({ bookId: 1, pageNumber: 1 });                    // page lookups (reserved)
BookSegmentSchema.index({ bookId: 1, content: 'text' });                  // BookSegment.find({ $text })
```

All three are **compound with `bookId` first**. That is not an accident: every read in the system
is "segments *of one book*", so the book id is the leading key and a search can never fan out
across the collection.

### 6.3 `voicesessions` (`database/models/voice-session.model.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `clerkId` | String | `index: true`; `sessionOwnerClerkId(userId)` — guests resolve to `"sample-books"` |
| `bookId` | ObjectId → `Book` | Which book was discussed |
| `startedAt` | Date | Set when the call starts, `default: Date.now` |
| `endedAt` | Date | Set by `endVoiceSession` |
| `durationSeconds` | Number | Client-measured call length, written on end |

The session lifecycle is intentionally split across two server actions so that **the row exists
before any audio flows** and is always closed:

```
startVoiceSession(bookId)                          endVoiceSession(sessionId, durationSeconds)
  auth() → userId | null                             auth() → userId | null
  Book.findOne({ _id, ...bookAccessFilter(userId) })  isValidObjectId(sessionId)
  VoiceSession.create({ clerkId, bookId, ... })       findOneAndUpdate({ _id, clerkId: owner })
  return { success, sessionId }                       → { endedAt, durationSeconds }
```

`findOneAndUpdate` is filtered by the owner, so one user can never close (or forge the duration of)
another user's session. `useVapi` also calls `endVoiceSession` from its `'call-end'`, `'error'` and
unmount cleanup paths, so a closed tab or a dropped connection still records the session.


---

## 7. Vapi engineering — a state machine in a hook

Vapi is treated as an **external, unreliable I/O boundary** (WebRTC audio + a hosted LLM), and
`hooks/useVapi.ts` is the adapter. It owns one SDK singleton, maps Vapi's event stream onto an
explicit UI status, keeps the transcript, times the call and guarantees session closure.

### 7.1 The SDK singleton

```ts
const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY

let vapi: InstanceType<typeof Vapi>
function getVapi() {
  if (!vapi) {
    if (!VAPI_API_KEY) throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set')
    vapi = new Vapi(VAPI_API_KEY)     // exactly one WebRTC client per page
  }
  return vapi
}
```

Lazy creation keeps module import side-effect-free and makes a missing key fail at *call time* with
a clear message instead of at build time. The public key is a browser key, so exposing it via
`NEXT_PUBLIC_` is intentional; the private key (`VAPI_PRIVATE_API_KEY`) is never referenced in client code.

### 7.2 Status as a state machine

`CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking'`

```
                  start()
        ┌────────┐ ─────────► ┌────────────┐   startVoiceSession ok + vapi.start()
        │  idle  │            │ connecting │ ─────────────────────────────────┐
        └────────┘ ◄───────── └────────────┘                                  │
            ▲              failure / limit                                   ▼
            │                                                     ┌───────────┐
            │                                                     │ starting  │ (AI speaks first)
            │          'speech-start'                             └─────┬─────┘
            │        ┌──────────────◄──────────────────────────────────┐ │
            │        ▼                                                  │ ▼
            │  ┌──────────┐  'speech-end'   ┌───────────┐             │ ┌───────────┐
            └─ │ speaking │ ─────────────► │ listening │ ◄───────────┘ │ thinking  │
   stop()      └──────────┘                └───────────┘  user final   └───────────┘
   /'call-end'     ▲                             │        transcript        ▲
   /'error'        └─────────────────────────────┴──────────────────────────┘
                        user speaks → AI reasons
```

Every transition is driven by a real Vapi event, never by a timer:

| Vapi event | Effect in `useVapi` |
| --- | --- |
| `call-start` | `status = 'starting'`, clear partials, start the 1 Hz duration interval |
| `speech-start` / `speech-end` | `status = 'speaking'` / `'listening'` |
| `message` (role `user`, `final`) | `status = 'thinking'`, clear the live user line, append the turn |
| `message` (`partial`) | Render word-by-word into `currentMessage` / `currentUserMessage` **without** committing |
| `message` (`final`) | Commit to `messages[]`, de-duplicating identical consecutive turns |
| `call-end` | `status = 'idle'`, stop timer, `endVoiceSession(sessionId, duration)` |
| `error` | `status = 'idle'`, classify the reason (timeout/silence, network, else) into a friendly message, close the session |

Supporting details that matter:

* **`isStoppingRef`** suppresses late `speech-*` events after the user pressed stop, so the UI does
  not flicker back to "listening" during teardown.
* **`durationRef` via `useLatestRef`** gives the event handlers a *fresh* duration without
  re-subscribing the handlers on every tick (effect deps stay `[durationRef]`).
* **Partial vs. final transcripts are separate concerns**: partials stream into ephemeral state
  for the typewriter effect, finals land in `messages[]` (with a de-dupe guard, because React
  strict-mode/delayed events can replay the same string).
* **Handlers are registered and removed symmetrically** (`Object.entries(handlers).forEach(...)`
  in both the setup and the cleanup), and the unmount cleanup also stops the call and ends the
  session, so navigating away mid-conversation does not leak a live session row.

### 7.3 Starting a call = session first, then audio

```ts
const result = await startVoiceSession(book._id)   // 1. authorise + create the VoiceSession row
if (!result.success) { show error; status = 'idle'; return }

await getVapi().start(ASSISTANT_ID, {
  firstMessage: `Hey, good to meet you. Quick question before we dive in - have you actually read ${book.title} yet, or are we starting fresh?`,
  variableValues: { title, author, bookId: book._id },   // ◄── how the assistant learns the bookId
  voice: { provider: '11labs', voiceId: voice.id, model: 'eleven_turbo_v2_5',
           stability, similarityBoost, style, useSpeakerBoost },
})
```

Ordering is the safety property: **the database row is created only if the viewer may read the
book** (`startVoiceSession` re-applies `bookAccessFilter`), and only then does audio start. The
`voice` object is derived from the book's stored `persona` through `getVoice()` →
`getVoiceKey()`, which tolerates a canonical key, a display name ("Dave") or a raw ElevenLabs id and
falls back to `DEFAULT_VOICE` — so a hand-edited or legacy `persona` can never break a call.
`VOICE_SETTINGS` (stability `0.45`, similarityBoost `0.75`, style `0`, speaker boost on) and
`VAPI_DASHBOARD_CONFIG` (smart endpointing, 30 s silence timeout, backchanneling) document the
tuning that lives in the Vapi dashboard.

`ASSISTANT_ID` comes from `process.env.NEXT_PUBLIC_ASSISTANT_ID`; the same assistant serves every
book, and the per-book context arrives through `variableValues` — i.e. **one prompt, many books**,
which is why the retrieval tool is the only place book text enters the conversation.


---

## 8. Vapi ⇄ database — the retrieval bridge

This is the operational heart of the app: how a spoken question becomes grounded text. Vapi's
assistant is configured (**in the Vapi dashboard**) with a custom tool named `searchBook` whose
server URL is `POST /api/vapi/search-book`. When the model decides it needs the book, Vapi makes an
outbound HTTPS request into this app — the moment the "third-party voice platform" touches private
data, and therefore the moment that must be defended.

```
 User: "What did Gatsby believe about the green light?"
        │
        ▼  audio (WebRTC)
 ┌──────────────────────┐   ASR → LLM decides to call tool `searchBook`
 │      Vapi cloud       │
 └──────────┬───────────┘
            │ POST /api/vapi/search-book
            │ { message: { toolCallList: [ { id, function: { name: "searchBook",
            │                                            arguments: { bookId, query } } } ] } }
            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ app/api/vapi/search-book/route.ts                                            │
 │  1. auth()                          → userId | null      (Clerk, server-side) │
 │  2. parseArgs()                     → accepts JSON *string* OR object         │
 │  3. accept BOTH Vapi payload shapes: functionCall | toolCallList/toolCalls    │
 │  4. processBookSearch(bookId, query, userId)                                  │
 │       → searchBookSegments(bookIdStr, queryStr, 5, userId)                    │
 │  5. shape the answer back:  { result: "…" } | { results: [{ toolCallId,… }] } │
 └───────────────────────────────┬──────────────────────────────────────────────┘
                                 ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ lib/actions/book.action.ts → searchBookSegments(bookId, query, limit, userId) │
 │  a. isValidObjectId(bookId)                                                   │
 │  b. Book.findOne({ _id, ...bookAccessFilter(userId) }, { _id: 1 })  ← ACL      │
 │  c. extractKeywords(query) → lowercase, strip non-alphanumerics,              │
 │       drop words ≤ 2 chars, drop STOPWORDS, de-duplicate                      │
 │  d. $text: { $search: keywords.join(' ') } + textScore sort   (primary)       │
 │  e. regex fallback (2 passes) if no text index / no hits      (secondary)     │
 └───────────────────────────────┬──────────────────────────────────────────────┘
                                 ▼  top 5 segments joined with "\n\n"
                     { result: "<grounded passage>" }
                                 │
                     back into the LLM prompt → spoken answer via 11Labs
```


### 8.1 Why the endpoint is defensive about *shape*

Vapi has shipped more than one tool-call payload format, so the route deliberately accepts both
rather than betting on one:

* **Single-call shape** — `message.functionCall = { name, parameters }`, answered with `{ result }`.
* **Multi-call shape** — `message.toolCallList` (or the legacy `message.toolCalls`), each entry
  `{ id, function: { name, arguments } }`, answered with `{ results: [{ toolCallId, result }] }`.

`parseArgs()` exists because `arguments`/`parameters` arrive either as an object or as a JSON
**string**; it `JSON.parse`s strings and falls back to `{}` on garbage. Argument validation is done
on the raw values *before* stringification, specifically so `null`/`undefined` cannot become the
literals `"null"`/`"undefined"` and accidentally look like a valid book id.

`GET /api/vapi/search-book` returns `{ status: 'ok' }` — a cheap, unauthenticated liveness probe so
Vapi's tool configuration can be verified with a browser before a call.

### 8.2 The access check is the first database operation

```ts
const book = await Book.findOne(
  { _id: bookObjectId, ...bookAccessFilter(userId) },
  { _id: 1 },
).lean()

if (!book) return { success: false, error: 'Book not found', data: [] }
```

Nothing is read from `booksegments` until a `Book` row matching *both* the id and the caller's
access filter exists. `bookAccessFilter(userId)` is:

```ts
userId ? { $or: [{ clerkId: 'sample-books' }, { clerkId: userId }] } : { clerkId: 'sample-books' }
```

so a guest (a Vapi call started while signed out) can only ever retrieve from the public sample
library, a signed-in user from the samples plus their **own** books, and a known `bookId` for
somebody else's book resolves to `'No information found about this topic in the book.'` — the same
message as "topic absent", which deliberately reveals nothing about whether the book exists.

### 8.3 The retrieval strategy: `$text` first, regex second

Queries are conversational ("what did he think about **the** green light?"), not keyword queries, so
they are normalised before they ever reach Mongo:

```
extractKeywords(query):
  lowercase → replace /[^a-z0-9\s']/ with space → split on whitespace
           → keep words where length > 2 AND word ∉ STOPWORDS → Set (de-duplicate)
```

`STOPWORDS` is a curated ~90-entry set that removes both ordinary English filler (*the, and, about*)
**and** question artefacts specific to this product (*book, author, chapter, talk, mention, tell,
read, remember, question, anything*). Removing that second group matters: without it "what does the
book say about X" would search for *book* and drown the real subject.

```
                    ┌── keywords.length === 0 ──► { success: true, data: [] }   (no query at all)
                    │
  $text {$search: k1 k2 k3…}            ← PRIMARY: index-backed, ranked by textScore
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
                    │
        throws (no text index) or 0 hits
                    ▼
  PASS 1  $and: [ content ~ /k1/i, content ~ /k2/i, … ]   ← ALL keywords (most specific)
                    │  0 hits
                    ▼
  PASS 2  $or:  [ content ~ /k1/i, … ]                    ← ANY keyword…
          then rank in JS by matchCount desc, slice(5)       …but best matches first
```

Three properties fall out of this design:

* **It degrades instead of failing.** The `try/catch` around `$text` means a database provisioned
  without the text index still answers, just via regex.
* **It prefers precision, then recall.** Pass 1 demands *every* keyword (few, high-confidence hits);
  pass 2 accepts *any* keyword but sorts by how many matched, so the best candidate is still first
  rather than the earliest one in the book.
* **It is bounded.** `limit = 5` segments (~2 500 words) is the context budget for one tool call, and
  the projection is narrowed to `_id bookId content segmentIndex pageNumber wordCount` so the
  response never carries `clerkId` or any other metadata the model does not need.

Regex keywords are escaped with `escapeRegex()` before becoming `RegExp` objects, so a spoken phrase
containing `.`, `*`, `(`, `[` etc. cannot become a pathological pattern or a syntax error. The joined
result is returned as a **plain string** (`{ result }`), because that is what the Vapi tool contract
feeds back into the model as the tool's output; the assistant then speaks the answer, and with
`eleven_turbo_v2_5` the latency of that extra round trip stays low enough to feel conversational.


---

## 9. Access control — one policy, four enforcement points

`lib/book-access.ts` is the single source of truth (it lives outside `lib/actions/*` because a
`"use server"` module may only export async functions). One predicate, reused everywhere:

| Viewer | Sample books (`clerkId = "sample-books"`) | Own books | Someone else's books |
| --- | --- | --- | --- |
| Signed out | ✅ | — | ❌ |
| Signed in | ✅ | ✅ | ❌ |

It is enforced at four layers, from the edge inward:

1. **`proxy.ts` (Clerk middleware)** — `/`, `/books`, `/books/session/*`, `/home`, `/sign-in`,
   `/sign-up` are public; every other non-asset path hits `auth.protect()`. `/books/add` is therefore
   never reachable signed out.
2. **The session page** (`/books/session/[slug]`) — `getBookForSession(slug, userId)` applies
   `bookAccessFilter`; anything unreadable redirects to `/books` (no error page that would leak
   existence).
3. **Server actions** — `startVoiceSession` re-checks access before creating a session row, and
   `createBook` / `saveBookSegments` / `deleteBook` scope writes with `clerkId: userId`.
4. **The Vapi tool endpoint** — `searchBookSegments` applies the same filter, so the *only* path from
   the voice platform into the data layer is authorised per request.

Two consequences worth stating explicitly: the middleware is a **fast path, not the security
boundary** (pages and actions assume it might not have run and re-check independently), and guests
are **first-class** — they are attributed to `SAMPLE_BOOKS_CLERK_ID` rather than being blocked, which
keeps the demo path working without opening any private data.

---

## 10. Observability — PostHog, correctly wired

`instrumentation-client.ts` initialises PostHog **once per page load** — it is Next.js' built-in
client hook, so no React provider or effect can run it a second time. Deliberate settings:

* `capture_pageview: false`, because pageviews are reported by `components/posthog-page-view.tsx`.
  The SDK's History-API monitor is not started here, so automatic pageviews would only ever cover the
  first load; keeping one source of truth avoids double counting.
* `defaults: '2026-05-30'` pins the SDK's modern default behaviour.
* Initialisation is **skipped entirely** when `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is unset, so a local
  environment without analytics logs no SDK error.
* Only `NEXT_PUBLIC_*` values are used client-side — no secrets, no user data.

`PostHogPageView` fires `$pageview` on every App Router route change *and* every query-string change,
with two subtleties: a module-level `lastCapturedUrl` suppresses the duplicate the double-invoked dev
effect would otherwise send, and **the session slug is masked** before capture:

```ts
const SESSION_PREFIX = '/books/session/'
const safePath = pathname.startsWith(SESSION_PREFIX) ? `${SESSION_PREFIX}[slug]` : pathname
```

Because a session path is derived from the book *title*, this is a privacy control, not cosmetics:
private titles must not leave the app. `PostHogPageView` is wrapped in `React.Suspense` in
`app/layout.tsx` (it reads `useSearchParams`, which suspends during shell render), and
`@vercel/analytics` runs alongside it.


---

## 11. Testing & CI — the invariants, pinned

Tests target the **rules**, not the UI, and they are pure unit tests: `jest.config.cjs` uses
`ts-jest` with `testEnvironment: 'node'` and the same `@/*` path mapping as the app
(`moduleNameMapper` → `<rootDir>/$1`), while `clearMocks: true` keeps suites independent. Crucially,
**no database and no network** are involved — Clerk, Mongoose, the models and `@vercel/blob` are all
`jest.mock`ed, so the suite runs in CI in seconds.

| Suite | What it locks down |
| --- | --- |
| `__tests__/book-access.test.ts` | The policy table: guests + sample books, guests vs. private books, owner vs. other user, `bookAccessFilter` shapes, guest sessions attributed to `"sample-books"` |
| `__tests__/book-action.test.ts` | `createBook` rejects a signed-out caller *and* a forged `clerkId` **without opening a connection**, refuses book #11, uses the authenticated owner id, and reports a taken slug without echoing the other document; `saveBookSegments` enforces ownership and rejects malformed ids before any write; `searchBookSegments` reads nothing for an unreadable book and scopes the ACL query to `$or [sample-books, own]` vs. sample-only for guests |
| `__tests__/feature-flags.test.ts` | `isFeatureEnabled` accepts `true/1/yes/on`, rejects everything else, and honours the fallback for missing/blank values |

The "without opening a connection" assertions are the sharpest ones: they prove authorisation happens
*before* the expensive resource is touched, which is also what keeps a rejected request cheap.

**CI** (`.github/workflows/unit-tests.yml`, "TESTS") runs on every `push` and `pull_request` with
`permissions: contents: read` and three *independent* jobs, so a lint failure never hides a test
failure:

```
unit-tests  checkout → setup-node@v4 (node 22, cache npm) → npm ci → npm run test:unit   (≤10 min)
lint        checkout → setup-node@v4 (node 22, cache npm) → npm ci → npm run lint        (≤10 min)
build       checkout → setup-node@v4 (node 22, cache npm) → npm ci → npm run build       (≤15 min)
```

Installing from the lockfile (`npm ci`) with npm caching makes the jobs reproducible and fast, and
the production build doubles as a TypeScript / route / App-Router contract check.

---

## 12. Operations — environment, seeding and the DNS trap

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | both / server | Clerk auth |
| `MONGODB_URI` | server | Atlas connection string (`mongodb+srv://…`) |
| `DNS_SERVERS` | server | Optional resolver override (see below) |
| `BLOB_READ_WRITE_TOKEN` | server | Vercel Blob write token for the PDF/cover |
| `NEXT_PUBLIC_VAPI_API_KEY` / `NEXT_PUBLIC_ASSISTANT_ID` | client | Vapi web SDK + assistant |
| `FF_DUMMY_BOOKS` / `FF_DUMMY_FORM` | server | Run on bundled sample data / simulate the form |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_HOST` | client | Analytics |

**The DNS trap.** `mongodb+srv://` needs the driver to resolve SRV records
(`_mongodb._tcp.<cluster>.mongodb.net`) *before* it can connect. On some networks (VPNs, offices,
certain ISPs) Node's resolver (c-ares) fails while browsers keep working, surfacing as
`querySrv ECONNREFUSED`. `lib/dns-bootstrap.ts` probes `resolve4('one.one.one.one')` and **only** if
that fails does it `dns.setServers([...])` with `8.8.8.8, 1.1.1.1, 8.8.4.4, 1.0.0.1` (or
`DNS_SERVERS`). It is invoked from three places so no entry point is left broken: `instrumentation.ts`
(`register()`, Node runtime only), `database/mongoose.ts` before every connect, and the standalone
scripts.

**Connection reuse.** `database/mongoose.ts` caches the connection on `globalThis.mongooseCache`
(`{ conn, promise }`), so hot reloads and concurrent route invocations share one pool, and a failed
connect clears `promise` so the next caller retries instead of inheriting a poisoned promise. It sets
`bufferCommands: false` (fail fast rather than silently queueing) plus `connectTimeoutMS: 8 s` and
`serverSelectionTimeoutMS: 6 s`.

**Scripts** (`package.json`):

| Script | File | Effect |
| --- | --- | --- |
| `npm run db:clear` | `database/clear-db.mjs` | Drops the whole database |
| `npm run db:seed-samples` | `database/seed-samples.mjs` | Uploads the bundled PDFs/covers to Blob, parses them with `pdfjs-dist/legacy` (`disableWorker: true`), inserts the `books` + `booksegments` rows for `SAMPLE_BOOKS` |
| `npm run db:check-voices` | `database/check-voices.mjs` | Read-only diagnostic: prints each book's stored `persona` and the voice it resolves to (mirrors `getVoiceKey`) |
| `npm run test:limit` | `database/test-book-limit.mjs` | Exercises the `USER_MAX_BOOK` rule end to end |
| `npm run test:unit` | `jest.config.cjs` | The unit suite that CI runs |

The seed script is the server-side counterpart of the browser pipeline: same 500/50 splitter, same
schema, but it parses with `pdfjs-dist/legacy` and `disableWorker: true` because there is no DOM. It
is **destructive by design** (it deletes the previous sample rows and their segments before
re-inserting), which is exactly what makes "re-seed" a repeatable operation.

---

## 13. Summary of the three pillars

1. **PDF intake** — parsed in the browser by `pdfjs-dist` (text + generated page-1 cover), authorised
   and stored via Vercel Blob client tokens, so the server never handles file bytes.
2. **Splitting & storage** — `splitIntoSegments` fans the text into overlapping 500-word windows,
   stored as `booksegments` documents under a `bookId`-leading compound index set (unique ordering,
   `$text` search), turned over idempotently by `saveBookSegments`.
3. **Vapi** — a hook-level state machine over a single SDK client tracks the live call, and the
   `searchBook` tool re-enters the app through a Clerk-authenticated route that re-checks access and
   answers with the top 5 ranked segments, giving the voice agent grounded, private, per-request
   retrieval instead of a static prompt.

