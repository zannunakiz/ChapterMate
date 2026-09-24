import { auth } from "@clerk/nextjs/server"
import { getUserBooks } from "@/lib/actions/book.action"
import { myBooks as sampleMyBooks, type Book } from "@/lib/constants"
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
    return <BooksView myBooks={sampleMyBooks} myBooksRequireAuth={false} />
  }

  const { userId } = await auth()
  const result = userId ? await getUserBooks(userId) : null
  const raw: unknown = result && "data" in result ? result.data : []
  const rows = Array.isArray(raw) ? (raw as MongoBook[]) : []

  return <BooksView myBooks={rows.map(toCardBook)} myBooksRequireAuth />
}
