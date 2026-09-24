import { auth } from "@clerk/nextjs/server"
import { getUserBooks } from "@/lib/actions/book.action"
import {
  myBooks as bundledMyBooks,
  sampleBooks as bundledSampleBooks,
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
export default async function BooksPage() {
  if (isDummyBooksEnabled()) {
    return (
      <BooksView
        sampleBooks={bundledSampleBooks}
        myBooks={bundledMyBooks}
        myBooksRequireAuth={false}
      />
    )
  }

  const { userId } = await auth()
  const [sampleResult, userResult] = await Promise.all([
    getUserBooks("sample-books"),
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
    />
  )
}
