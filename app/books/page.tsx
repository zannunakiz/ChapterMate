import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { BooksGridSkeleton } from "@/components/BooksGridSkeleton"
import { Navigation } from "@/components/landing/navigation"
import { getUserBooks } from "@/lib/actions/book.action"
import {
  myBooks as bundledMyBooks,
  sampleBooks as bundledSampleBooks,
  SAMPLE_BOOKS_CLERK_ID,
  type Book,
} from "@/lib/constants"
import { isDummyBooksEnabled } from "@/lib/feature-flags"
import { BooksView } from "./books-view"

type MongoBook = {
  title?: string
  author?: string
  slug?: string
  coverURL?: string
  createdAt?: string | Date
}

// Stable picsum fallback for books saved without a cover. The card uses the
// stored `coverURL` whenever it exists.
function coverIdFromSlug(slug: string): number {
  let hash = 0

  for (let index = 0; index < slug.length; index++) {
    hash = (hash * 31 + slug.charCodeAt(index)) % 10
  }

  return hash + 1
}

function toCardBook(book: MongoBook): Book {
  const slug = book.slug ?? ""

  return {
    title: book.title ?? "Untitled",
    author: book.author ?? "Unknown author",
    slug,
    coverURL: book.coverURL,
    coverId: coverIdFromSlug(slug)
  }
}

// Server component: resolves the data for the "My Books" tab and hands it to the
// unchanged NewVersion UI.
//
// FF_DUMMY_BOOKS on  -> bundled sample data (current behaviour).
// FF_DUMMY_BOOKS off -> the signed-in user's own books, read from the shared
//                       MongoDB through the same server action OldVersion uses.
//                       Signed-out visitors simply get an empty list.
//
// `dummyBooks` also tells the client view whether to keep its decorative
// loading delay: bundled data arrives instantly, database rows do not need the
// fake wait.

/**
 * Suspense fallback for the database path: the reading room plus its book-card
 * skeletons, so the skeletons arrive with the first chunk of HTML instead of
 * after the whole query. It lives here instead of in `app/books/loading.tsx` on
 * purpose — a segment-level `loading.tsx` would also become the fallback for
 * /books/add and /books/session/[slug].
 */
function BooksLoading() {
  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <Navigation />
      <div className="mx-auto max-w-[1200px] px-5 pt-32 md:px-8 lg:pt-40">
        <div className="max-w-2xl">
          <p className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Your reading room
          </p>
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight md:text-7xl">
            Books worth
            <br />
            staying with.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Build a thoughtful library of books and explore ideas with a little
            more intention.
          </p>
        </div>

        {/* Static stand-in for the tablist: the real buttons arrive with the
            page, so this stays non-interactive and out of the a11y tree. */}
        <div
          aria-hidden="true"
          className="mt-16 flex gap-7 border-b border-foreground/10"
        >
          <span className="relative pb-4 text-sm text-foreground">
            Sample Books
            <span className="absolute inset-x-0 -bottom-px h-px scale-x-100 bg-foreground" />
          </span>
          <span className="relative pb-4 text-sm text-muted-foreground">
            My Books
            <span className="absolute inset-x-0 -bottom-px h-px scale-x-0 bg-foreground" />
          </span>
        </div>

        <div className="mt-10">
          <BooksGridSkeleton />
        </div>
      </div>
    </main>
  )
}

export default function BooksPage() {
  if (isDummyBooksEnabled()) {
    return (
      <BooksView
        sampleBooks={bundledSampleBooks}
        myBooks={bundledMyBooks}
        myBooksRequireAuth={false}
        dummyBooks
      />
    )
  }

  return (
    <Suspense fallback={<BooksLoading />}>
      <BooksFromDatabase />
    </Suspense>
  )
}

// Reads the shared sample books plus the signed-in user's own books. Both
// queries run in parallel; signed-out visitors simply get an empty list.
async function BooksFromDatabase() {
  const { userId } = await auth()
  const [sampleResult, userResult] = await Promise.all([
    getUserBooks(SAMPLE_BOOKS_CLERK_ID),
    userId ? getUserBooks(userId) : Promise.resolve(null),
  ])
  const sampleRaw: unknown =
    sampleResult && "data" in sampleResult ? sampleResult.data : []
  const userRaw: unknown = userResult && "data" in userResult ? userResult.data : []
  const sampleRows = Array.isArray(sampleRaw) ? (sampleRaw as MongoBook[]) : []
  const userRows = Array.isArray(userRaw) ? (userRaw as MongoBook[]) : []

  return (
    <BooksView
      sampleBooks={sampleRows.map(toCardBook)}
      myBooks={userRows.map(toCardBook)}
      myBooksRequireAuth
      dummyBooks={false}
    />
  )
}
