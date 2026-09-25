import { auth } from "@clerk/nextjs/server"
import { AddBookFormPanel } from "@/components/AddBookFormPanel"
import { AddBookIntro } from "@/components/AddBookIntro"
import { AddBookLimitNotice } from "@/components/AddBookLimitNotice"
import { Navigation } from "@/components/landing/navigation"
import { getUserBooks } from "@/lib/actions/book.action"
import { USER_MAX_BOOK } from "@/lib/constants"
import { isDummyFormEnabled } from "@/lib/feature-flags"

/**
 * True when the signed-in user already owns `USER_MAX_BOOK` books. Signed-out
 * visitors are never at the limit (proxy.ts already protects /books/add), so
 * they simply get the form.
 */
async function hasReachedBookLimit(userId: string | null): Promise<boolean> {
  if (!userId) return false

  const result = await getUserBooks(userId)
  const raw: unknown = result && "data" in result ? result.data : []
  const books = Array.isArray(raw) ? raw : []

  return books.length >= USER_MAX_BOOK
}

// Ambient page decoration, shared by both page states.
function AddBookBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-x-0 bottom-[-18rem] h-[42rem] bg-[radial-gradient(ellipse_at_center,rgba(156,39,104,0.22),transparent_64%)] blur-3xl" />
      <div className="absolute bottom-[-10rem] left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-pink-900/15 blur-[100px]" />
      <div className="absolute left-[8%] top-32 h-px w-32 bg-foreground/25" />
      <div className="absolute right-[10%] top-48 h-40 w-px bg-foreground/15" />
      <div className="absolute -right-20 top-24 size-72 rounded-full border border-foreground/10" />
      <div className="absolute left-0 top-[58%] h-px w-full bg-foreground/[0.08]" />
    </div>
  )
}

export default async function AddBookPage() {
  const { userId } = await auth()

  // At the limit: no upload form, just the centred notice with a way back.
  if (await hasReachedBookLimit(userId)) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <Navigation />
        <AddBookBackdrop />
        <div className="relative flex min-h-screen items-center justify-center px-5 pb-28 pt-32 md:px-8">
          <AddBookLimitNotice />
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navigation />
      <AddBookBackdrop />
      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-32 md:px-8 lg:pt-40">
        <AddBookIntro />
        <AddBookFormPanel dummyForm={isDummyFormEnabled()} />
      </div>
    </main>
  )
}
