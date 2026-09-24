import { SAMPLE_BOOKS_CLERK_ID } from "@/lib/constants"

/**
 * Session-page access rules (single source of truth).
 *
 * | viewer                       | sample books (`sample-books`) | own books | other users' books |
 * | ---------------------------- | ----------------------------- | --------- | ------------------ |
 * | signed out                   | yes                           | —         | no                 |
 * | signed in                    | yes                           | yes       | no                 |
 *
 * Every restricted request is redirected to `/books`.
 *
 * Kept in its own module (not in `lib/actions/*`) because modules marked
 * `"use server"` may only export async functions.
 */

/** The subset of a book needed to decide access. */
export type BookOwnership = {
  clerkId?: string | null
}

/**
 * True when `userId` (null/undefined for signed-out visitors) may open the
 * session page of `book`.
 */
export function canAccessBook(
  book: BookOwnership,
  userId?: string | null,
): boolean {
  if (book.clerkId === SAMPLE_BOOKS_CLERK_ID) return true

  return Boolean(userId) && book.clerkId === userId
}

/** A Mongo `clerkId` filter matching every book the viewer may open. */
export type BookAccessFilter = {
  clerkId?: string
  $or?: Array<{ clerkId: string }>
}

/**
 * Mongo filter for "books this viewer may open" — spread it into a query so
 * unreadable documents are never loaded, e.g.
 * `Book.findOne({ slug, ...bookAccessFilter(userId) })`.
 */
export function bookAccessFilter(userId?: string | null): BookAccessFilter {
  if (!userId) return { clerkId: SAMPLE_BOOKS_CLERK_ID }

  // The viewer's own books plus the public sample books.
  return { $or: [{ clerkId: SAMPLE_BOOKS_CLERK_ID }, { clerkId: userId }] }
}

/**
 * `clerkId` to record on a voice session for this viewer.
 *
 * Signed-in users are tracked under their own Clerk user id; signed-out
 * visitors are attributed to the public sample-books owner so guest
 * conversations on sample books are still recorded.
 */
export function sessionOwnerClerkId(userId?: string | null): string {
  return userId ?? SAMPLE_BOOKS_CLERK_ID
}
