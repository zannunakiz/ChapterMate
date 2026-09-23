import { isDummyBooksEnabled } from "@/lib/feature-flags"
import { BooksView } from "./books-view"

// Server component: reads FF_DUMMY_BOOKS (a server-only env var) and passes the
// resolved flag down to the client view as a prop.
export default function BooksPage() {
  return <BooksView dummyBooks={isDummyBooksEnabled()} />
}
