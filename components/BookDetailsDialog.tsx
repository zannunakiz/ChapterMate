"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle
} from "@/components/ui/dialog"
import { bookCoverUrl, type Book } from "@/lib/constants"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

type BookDetailsDialogProps = {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BookDetailsDialog({
  book,
  open,
  onOpenChange
}: BookDetailsDialogProps) {
  const prefersReducedMotion = useReducedMotion()

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
                className="pr-8"
              >
                <p className="mb-3 text-[8px] uppercase tracking-[0.28em] text-muted-foreground">
                  Book overview
                </p>
                <DialogTitle className="max-w-[18ch] font-display text-2xl leading-[1.05] tracking-tight sm:text-3xl lg:text-4xl">
                  {book.title}
                </DialogTitle>
                <p className="mt-3 text-xs text-foreground/65 sm:text-sm">
                  {book.author}{" "}
                  <span className="px-2 text-muted-foreground">/</span>{" "}
                  {book.releaseYear}
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
                  <Button asChild className="h-9 rounded-full px-4 text-xs">
                    <a href={`/books/session/${book.slug}`}>
                      Start conversation{" "}
                      <ArrowUpRight className="ml-0 size-3" />
                    </a>
                  </Button>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      className="h-9 rounded-full px-4 text-xs"
                    >
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}
