import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the BookCard layout (cover, title, author) so the grid keeps its shape.
function BookCardSkeleton() {
  return (
    <div className="block">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl border border-foreground/25 bg-foreground/20" />
      <div className="pt-4">
        <Skeleton className="h-5 w-4/5 rounded-md bg-foreground/20" />
        <Skeleton className="mt-2 h-3.5 w-2/5 rounded-md bg-foreground/20" />
      </div>
    </div>
  )
}

// Placeholder cards: 5 from `sm` up; a 6th is added below `sm` so the
// two-column mobile grid stays full.
const SKELETON_COUNT = 5

/**
 * Book-card placeholders shared by the route fallback (`app/books/loading.tsx`,
 * shown while the page fetches the books) and the client-side waits in
 * `BooksView`, so both states look identical.
 */
export function BooksGridSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading books…</span>
      <div
        data-books-skeleton
        className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5"
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <BookCardSkeleton key={index} />
        ))}
        <div className="sm:hidden">
          <BookCardSkeleton />
        </div>
      </div>
    </div>
  )
}
