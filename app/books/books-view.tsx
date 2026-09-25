"use client"

import { useEffect, useState } from "react"
import { SignInButton, useAuth } from "@clerk/nextjs"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookCard } from "@/components/BookCard"
import { BookDetailsDialog } from "@/components/BookDetailsDialog"
import { BooksGridSkeleton } from "@/components/BooksGridSkeleton"
import { Button } from "@/components/ui/button"
import { Navigation } from "@/components/landing/navigation"
import { type Book } from "@/lib/constants"

type BooksViewProps = {
  sampleBooks: Book[]
  /** "My Books" tab data — the bundled samples or the signed-in user's books. */
  myBooks: Book[]
  /** True when "My Books" reads from the database and so needs a signed-in user. */
  myBooksRequireAuth: boolean
  /**
   * FF_DUMMY_BOOKS, read on the server and passed down as a prop. The bundled
   * data is already in the props, so the skeletons are held on purpose to mimic
   * a fetch. The database path skips that pause and paints as soon as the
   * server has the rows.
   */
  dummyBooks: boolean
}

/** Only the bundled (dummy) data pauses on the skeletons. */
const DUMMY_LOADING_DELAY_MS = 2000

export function BooksView({
  sampleBooks,
  myBooks,
  myBooksRequireAuth,
  dummyBooks,
}: BooksViewProps) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [activeTab, setActiveTab] = useState<"sample" | "mine">("sample")
  // Dummy mode starts on the skeletons; the database path starts on the real
  // rows the server already fetched.
  const [isLoading, setIsLoading] = useState(dummyBooks)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const books: Book[] = activeTab === "sample" ? sampleBooks : myBooks

  // Dummy fetch: hold the book-card skeletons for 2s on every tab switch, but
  // only for the bundled data. A database fetch has already resolved on the
  // server, so pausing here would just make the app feel slow.
  useEffect(() => {
    if (!dummyBooks) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timer = window.setTimeout(
      () => setIsLoading(false),
      DUMMY_LOADING_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [activeTab, dummyBooks])

  // "My Books" needs Clerk's client state to tell a signed-out visitor from an
  // empty library, so the database path waits for it instead of briefly showing
  // the wrong panel. That wait is not artificial and never applies to the
  // bundled data.
  const awaitingAuth = myBooksRequireAuth && activeTab === "mine" && !isLoaded

  const itemVariants = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={itemVariants}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="min-h-screen bg-background pb-24 text-foreground"
    >
      <Navigation />
      <div className="mx-auto max-w-[1200px] px-5 pt-32 md:px-8 lg:pt-40">
        <div data-books-item className="max-w-2xl">
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

        <div
          data-books-item
          className="mt-16 flex gap-7 border-b border-foreground/10"
          role="tablist"
          aria-label="Book collections"
        >
          {[
            { key: "sample", label: "Sample Books" },
            { key: "mine", label: "My Books" }
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key as "sample" | "mine")}
              className={`relative pb-4 text-sm transition-colors ${activeTab === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              <span
                className={`absolute inset-x-0 -bottom-px h-px bg-foreground transition-transform duration-300 ${activeTab === tab.key ? "scale-x-100" : "scale-x-0"}`}
              />
            </button>
          ))}
        </div>

        <div data-books-item className="mt-10">
          {isLoading || awaitingAuth ? (
            <BooksGridSkeleton />
          ) : activeTab === "mine" &&
            myBooksRequireAuth &&
            isLoaded &&
            !isSignedIn ? (
            <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.025] px-6 py-16 text-center sm:px-10 sm:py-24">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-900/15 blur-3xl"
              />
              <div className="relative mx-auto max-w-md">
                <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Your library
                </p>
                <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
                  Sign in to open your reading room.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  Log in to access your own books and upload new ones to talk
                  about.
                </p>
                <SignInButton mode="modal">
                  <Button className="mt-8 rounded-full px-6">Log in</Button>
                </SignInButton>
              </div>
            </div>
          ) : books.length === 0 && activeTab === "mine" ? (
            <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.025] px-6 py-16 text-center sm:px-10 sm:py-24">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-900/15 blur-3xl"
              />
              <div className="relative mx-auto max-w-md">
                <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Your library is waiting
                </p>
                <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
                  Start with a book worth keeping.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  Upload your first book and make it part of a reading room
                  built for deeper conversations.
                </p>
                <Button asChild className="mt-8 rounded-full px-6">
                  <a href="/books/add">Add your first book</a>
                </Button>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5"
              >
                {books.map((book, index) => (
                  <BookCard
                    key={book.slug}
                    book={book}
                    index={index}
                    onSelect={setSelectedBook}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
      <BookDetailsDialog
        book={selectedBook}
        open={selectedBook !== null}
        canDelete={Boolean(
          myBooksRequireAuth &&
            activeTab === "mine" &&
            isSignedIn &&
            userId,
        )}
        onOpenChange={(open) => {
          if (!open) setSelectedBook(null)
        }}
      />
    </motion.main>
  )
}
