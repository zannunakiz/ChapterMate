import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { VapiControls } from "@/components/VapiControls"
import { getBookForSession } from "@/lib/actions/book.action"
import type { IBook } from "@/types"

// Session access rules (see lib/book-access.ts):
//   signed out -> only the public sample books (clerkId "sample-books")
//   signed in  -> the sample books plus the user's own books (clerkId === userId)
// Anything else — another user's book or an unknown slug — redirects to /books.
export default async function BookSessionPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  // No sign-in redirect here on purpose: signed-out visitors may still open the
  // sample books, so `/books/session/*` is public in proxy.ts.
  const { userId } = await auth()

  const { slug } = await params
  const result = await getBookForSession(slug, userId)

  if (!result.success || !result.data) redirect("/books")

  return <VapiControls book={result.data as unknown as IBook} />
}
