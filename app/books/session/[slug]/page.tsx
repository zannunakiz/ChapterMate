import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { VapiControls } from "@/components/VapiControls"
import { getBookBySlug } from "@/lib/actions/book.action"
import type { IBook } from "@/types"

// Same flow as OldVersion's /books/[slug]: the visitor must be signed in and the
// book is resolved from MongoDB by slug.
export default async function BookSessionPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/")

  const { slug } = await params
  const result = await getBookBySlug(slug)

  if (!result.success || !result.data) redirect("/books")

  return <VapiControls book={result.data as unknown as IBook} />
}
