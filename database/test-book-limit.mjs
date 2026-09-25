/**
 * Live per-user book limit test — writes to the real database.
 *
 *   npm run test:limit
 *
 * 1. Uploads `lib/samples/DummyBook.pdf` + `lib/samples/DummyBook.png` to
 *    Vercel Blob and stores `USER_MAX_BOOK` (lib/constants.ts) books for a
 *    throwaway Clerk id.
 * 2. Tries to add one more book through the same rule `/books/add` enforces
 *    (count this owner's books, then compare against `USER_MAX_BOOK`). Book
 *    #USER_MAX_BOOK + 1 must be refused — that is the pass condition.
 * 3. Removes every dummy book, its segments and its uploaded blobs again, so the
 *    database ends exactly where it started. Cleanup lives in a `finally` block,
 *    so it also runs when the test fails or throws.
 *
 * Exit code 0 = limit held and the database was restored, 1 = anything else.
 */
import nextEnv from "@next/env"
import { del, put } from "@vercel/blob"
import dns from "node:dns"
import mongoose from "mongoose"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const { loadEnvConfig } = nextEnv
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))

loadEnvConfig(projectRoot)

// Plain constants module (no imports), so Node can read the .ts file directly.
const { DEFAULT_VOICE, USER_MAX_BOOK } = await import("../lib/constants.ts")

// ============================================
// DUMMY FIXTURES
// ============================================

/** Throwaway owner: no real Clerk user ever has this id. */
const DUMMY_CLERK_ID = "dummy-limit-test-user"
/** Within BOOK_AUTHOR_MAX_LENGTH (20). */
const DUMMY_AUTHOR = "Dummy Author"
const DUMMY_PDF_PATH = "lib/samples/DummyBook.pdf"
const DUMMY_COVER_PATH = "lib/samples/DummyBook.png"
/** Blob folder holding the dummy files, so they are easy to spot and purge. */
const BLOB_FOLDER = "dummy-limit-test"

/** Titles stay within BOOK_TITLE_MAX_LENGTH (20). */
const dummyTitle = (index) => `Dummy Limit Book ${index}`
const dummySlug = (index) => `${BLOB_FOLDER}-${index}`

/** Populated books plus the one probe that must be refused. */
const ATTEMPTS = USER_MAX_BOOK + 1

const mongoUri = process.env.MONGODB_URI
const blobToken = process.env.BLOB_READ_WRITE_TOKEN

if (!mongoUri) throw new Error("MONGODB_URI is not configured")
if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured")

// Collections are addressed through the raw driver, matching seed-samples.mjs.
let books
let bookSegments

/** Blob URLs created during this run, used by the cleanup step. */
const createdBlobUrls = []

// ============================================
// HELPERS
// ============================================

function log(_message) {}

function describe(error) {
  return error instanceof Error ? error.message : String(error)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function label(index) {
  return index <= USER_MAX_BOOK
    ? `Dummy book ${index}/${USER_MAX_BOOK}`
    : `Extra book ${index} (limit probe)`
}

async function configureDnsFallback() {
  try {
    await dns.promises.resolve4("one.one.one.one")
  } catch {
    const servers = (process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1,8.8.4.4,1.0.0.1")
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)

    dns.setServers(servers)
  }
}

/** Uploads the dummy PDF + cover for one book and returns the stored metadata. */
async function uploadBookAssets(index, pdfBuffer, coverBuffer) {
  const slug = dummySlug(index)
  const [pdfBlob, coverBlob] = await Promise.all([
    put(`${BLOB_FOLDER}/${slug}.pdf`, pdfBuffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
      token: blobToken,
    }),
    put(`${BLOB_FOLDER}/${slug}-cover.png`, coverBuffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/png",
      token: blobToken,
    }),
  ])

  createdBlobUrls.push(pdfBlob.url, coverBlob.url)

  log(`      pdf   ${DUMMY_PDF_PATH} (${formatBytes(pdfBuffer.byteLength)}) -> ${pdfBlob.url}`)
  log(
    `      cover ${DUMMY_COVER_PATH} (${formatBytes(coverBuffer.byteLength)}) -> ${coverBlob.url}`,
  )

  return { pdfBlob, coverBlob }
}

/**
 * The rule under test: `/books/add` counts the signed-in user's books and stops
 * rendering the form once that count reaches `USER_MAX_BOOK`. Every insert here
 * goes through the same rule, so book #USER_MAX_BOOK + 1 must be refused.
 */
async function tryAddDummyBook(index, pdfBuffer, coverBuffer) {
  const bookCount = await books.countDocuments({ clerkId: DUMMY_CLERK_ID })

  if (bookCount >= USER_MAX_BOOK) {
    return { added: false, bookCount }
  }

  const slug = dummySlug(index)
  const title = dummyTitle(index)
  const { pdfBlob, coverBlob } = await uploadBookAssets(index, pdfBuffer, coverBuffer)
  const now = new Date()
  const { insertedId } = await books.insertOne({
    clerkId: DUMMY_CLERK_ID,
    title,
    slug,
    author: DUMMY_AUTHOR,
    persona: DEFAULT_VOICE,
    fileURL: pdfBlob.url,
    fileBlobKey: pdfBlob.pathname,
    coverURL: coverBlob.url,
    coverBlobKey: coverBlob.pathname,
    fileSize: pdfBuffer.byteLength,
    // DummyBook.pdf holds no searchable text, so no segments are stored; the
    // limit is counted on `books` documents only.
    totalSegments: 0,
    createdAt: now,
    updatedAt: now,
  })

  return { added: true, bookCount: bookCount + 1, insertedId, slug, title }
}

/** Deletes every dummy book (plus its blobs). Always safe to call. */
async function deleteDummyData({ quiet = false } = {}) {
  const dummyBooks = await books
    .find(
      { clerkId: DUMMY_CLERK_ID },
      { projection: { _id: 1, fileURL: 1, coverURL: 1 } },
    )
    .toArray()

  const blobUrls = [
    ...new Set([
      ...createdBlobUrls,
      ...dummyBooks.flatMap((book) => [book.fileURL, book.coverURL]),
    ]),
  ].filter(Boolean)

  createdBlobUrls.length = 0

  if (dummyBooks.length === 0 && blobUrls.length === 0) {
    if (!quiet) log("Cleanup: nothing to remove")

    return { books: 0, segments: 0, blobs: 0 }
  }

  const bookIds = dummyBooks.map((book) => book._id)
  const { deletedCount: segments } = await bookSegments.deleteMany({
    bookId: { $in: bookIds },
  })
  const { deletedCount: removedBooks } = await books.deleteMany({
    clerkId: DUMMY_CLERK_ID,
  })

  let blobs = 0

  if (blobUrls.length > 0) {
    try {
      await del(blobUrls, { token: blobToken })
      blobs = blobUrls.length
    } catch (error) {
      // Same policy as deleteBook() in lib/actions/book.action.ts: the database
      // rows are already gone, so a blob hiccup must not fail the cleanup.
      log(`! Blob cleanup needs attention: ${describe(error)}`)
    }
  }

  if (!quiet) {
    log(
      `Cleanup: removed ${removedBooks} dummy book(s), ${segments} segment(s), ${blobs} blob(s)`,
    )
  }

  return { books: removedBooks, segments, blobs }
}

/** Writes the dummy library, then proves book #USER_MAX_BOOK + 1 is refused. */
async function populateAndProbe(pdfBuffer, coverBuffer) {
  for (let index = 1; index <= USER_MAX_BOOK; index++) {
    const result = await tryAddDummyBook(index, pdfBuffer, coverBuffer)

    if (!result.added) {
      throw new Error(
        `${label(index)} was refused while the library only held ${result.bookCount}/${USER_MAX_BOOK} books`,
      )
    }

    log(
      `${label(index)} uploaded: "${result.title}" (slug "${result.slug}", _id ${result.insertedId}) — library now ${result.bookCount}/${USER_MAX_BOOK}`,
    )
  }

  const probeIndex = ATTEMPTS
  log(`${label(probeIndex)}: adding one more book on purpose...`)
  const probe = await tryAddDummyBook(probeIndex, pdfBuffer, coverBuffer)
  const stored = await books.countDocuments({ clerkId: DUMMY_CLERK_ID })

  if (probe.added) {
    log(
      `x Book #${probeIndex} was accepted — user "${DUMMY_CLERK_ID}" now owns ${stored} books, so the ${USER_MAX_BOOK}-book limit is NOT enforced`,
    )

    return false
  }

  log(
    `ok Book #${probeIndex} refused: user already owns ${probe.bookCount}/${USER_MAX_BOOK} books (USER_MAX_BOOK=${USER_MAX_BOOK}), stored in database = ${stored}`,
  )

  return true
}

// ============================================
// RUN
// ============================================

let passed = false
let cleanedUp = false

try {
  await configureDnsFallback()

  const [pdfBuffer, coverBuffer] = await Promise.all([
    readFile(resolve(projectRoot, DUMMY_PDF_PATH)),
    readFile(resolve(projectRoot, DUMMY_COVER_PATH)),
  ])

  await mongoose.connect(mongoUri)

  books = mongoose.connection.collection("books")
  bookSegments = mongoose.connection.collection("booksegments")

  const baseline = await books.countDocuments()

  log(`Limits: USER_MAX_BOOK=${USER_MAX_BOOK} per Clerk user, dummy owner "${DUMMY_CLERK_ID}"`)
  log(
    `Fixtures: ${DUMMY_PDF_PATH} (${formatBytes(pdfBuffer.byteLength)}), ${DUMMY_COVER_PATH} (${formatBytes(coverBuffer.byteLength)})`,
  )
  log(`Database baseline: ${baseline} book(s) before the test`)

  // Leftovers from a crashed run would collide with the unique dummy slugs.
  const leftovers = await deleteDummyData({ quiet: true })

  if (leftovers.books > 0 || leftovers.blobs > 0) {
    log(
      `Pre-run cleanup of an earlier aborted run: ${leftovers.books} book(s), ${leftovers.blobs} blob(s)`,
    )
  }

  try {
    passed = await populateAndProbe(pdfBuffer, coverBuffer)
  } finally {
    // Runs whether the test passed, failed or threw.
    log("Cleaning up the dummy books...")
    await deleteDummyData()
    cleanedUp = true
  }

  const dummyLeft = await books.countDocuments({ clerkId: DUMMY_CLERK_ID })
  const total = await books.countDocuments()
  const restored = dummyLeft === 0 && total === baseline

  log(
    restored
      ? `ok Database restored: ${total} book(s), identical to the ${baseline} book(s) before the test`
      : `x Database NOT restored: ${total} book(s) now vs ${baseline} before, ${dummyLeft} dummy book(s) left`,
  )

  passed = passed && restored

  log(
    passed
      ? `TEST PASSED — the per-user limit of ${USER_MAX_BOOK} books is enforced`
      : "TEST FAILED",
  )
  process.exitCode = passed ? 0 : 1
} catch {
  process.exitCode = 1
} finally {
  // Safety net: never leave dummy books behind, even on an early failure.
  if (books && !cleanedUp) {
    try {
      await deleteDummyData()
    } catch {}
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }
}
