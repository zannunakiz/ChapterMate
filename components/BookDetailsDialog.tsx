"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle
} from "@/components/ui/dialog"
import { bookCoverUrl, type Book } from "@/lib/constants"
import { deleteBook } from "@/lib/actions/book.action"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type BookDetailsDialogProps = {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canDelete: boolean
}

export function BookDetailsDialog({
  book,
  open,
  onOpenChange,
  canDelete
}: BookDetailsDialogProps) {
  const prefersReducedMotion = useReducedMotion()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset state gracefully when dialog is closed
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setIsConfirmingDelete(false)
        setIsDeleting(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleDelete = async () => {
    if (!book || !canDelete) return

    setIsDeleting(true)
    try {
      const result = await deleteBook(book.slug)

      if (!result.success) throw new Error(result.error)

      toast.success("Book deleted")

      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      toast.error("Delete failed")
      // Revert to original state upon failure
      setIsConfirmingDelete(false)
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-5xl overflow-hidden border-foreground/15 bg-background p-0 shadow-[0_28px_90px_-30px_rgba(0,0,0,0.85)] sm:h-[min(520px,calc(100vh-2rem))] sm:max-h-[calc(100vh-2rem)]">
        {book && (
          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08 } }
            }}
            className="grid max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:h-full sm:grid-cols-[42%_58%] sm:overflow-hidden"
          >
            <motion.div
              variants={
                prefersReducedMotion
                  ? undefined
                  : {
                    hidden: { opacity: 0, scale: 0.98 },
                    visible: { opacity: 1, scale: 1 }
                  }
              }
              data-dialog-item
              className="relative h-44 overflow-hidden bg-muted sm:h-full"
            >
              <img
                src={bookCoverUrl(book, 500, 750)}
                alt={`Cover of ${book.title}`}
                className="h-full w-full object-cover grayscale-[10%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white/80">
                <p className="text-[9px] uppercase tracking-[0.28em]">
                  ChapterMate library
                </p>
              </div>
            </motion.div>
            <motion.div
              variants={
                prefersReducedMotion
                  ? undefined
                  : {
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0 }
                  }
              }
              className="flex min-w-0 flex-col overflow-y-auto px-5 py-6 sm:px-9 sm:py-10 lg:px-12 lg:py-12"
            >
              <motion.div
                variants={
                  prefersReducedMotion
                    ? undefined
                    : {
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 }
                    }
                }
                data-dialog-item
                className="min-w-0 overflow-hidden pr-8"
              >
                <p className="mb-3 text-[8px] uppercase tracking-[0.28em] text-muted-foreground">
                  Book overview
                </p>
                <DialogTitle
                  title={book.title}
                  className="line-clamp-3 max-w-[18ch] break-words font-display text-2xl leading-[1.05] tracking-tight sm:text-3xl lg:text-4xl"
                >
                  {book.title}
                </DialogTitle>
                <p
                  title={book.author}
                  className="mt-3 truncate text-xs text-foreground/65 sm:text-sm"
                >
                  {book.author}
                </p>
              </motion.div>
              <motion.div
                variants={
                  prefersReducedMotion
                    ? undefined
                    : {
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 }
                    }
                }
                className="mt-auto"
              >
                <DialogFooter
                  data-dialog-item
                  className="flex-col items-stretch gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end"
                >
                  <AnimatePresence mode="wait">
                    {!isConfirmingDelete ? (
                      <motion.div
                        key="default-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center"
                      >
                        <Button asChild className="h-9 rounded-full px-4 text-xs">
                          <a href={`/books/session/${book.slug}`}>
                            Start conversation{" "}
                            <ArrowUpRight className="ml-0 size-3" />
                          </a>
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mx-auto h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:mx-0"
                            onClick={() => setIsConfirmingDelete(true)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="confirm-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex w-full flex-row items-center justify-end gap-2 sm:w-auto"
                      >
                        <span className="mr-2 text-xs font-medium text-muted-foreground">
                          Delete?
                        </span>
                        <Button
                          variant="ghost"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => setIsConfirmingDelete(false)}
                          disabled={isDeleting}
                        >
                          No
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-9 min-w-[64px] rounded-full px-4 text-xs"
                          onClick={handleDelete}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Yes"
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </DialogFooter>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}
