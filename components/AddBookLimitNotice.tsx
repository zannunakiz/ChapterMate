"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { USER_MAX_BOOK } from "@/lib/constants"

/**
 * Shown on `/books/add` instead of the upload form when the signed-in user
 * already owns `USER_MAX_BOOK` books.
 */
export function AddBookLimitNotice() {
  const prefersReducedMotion = useReducedMotion()
  const itemVariants = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
      }}
      className="relative mx-auto max-w-xl text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-900/15 blur-3xl"
      />
      <div className="relative">
        <motion.p
          variants={itemVariants}
          className="mb-4 text-xs uppercase tracking-[0.28em] text-muted-foreground"
        >
          Library full
        </motion.p>
        <motion.h1
          variants={itemVariants}
          className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
        >
          You have reached your {USER_MAX_BOOK}-book limit.
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground"
        >
          Your reading room holds up to {USER_MAX_BOOK} books. Delete a book you
          are finished with to make room for a new one — its saved
          conversations are removed too.
        </motion.p>
        <motion.div variants={itemVariants}>
          <Button asChild className="mt-8 rounded-full px-6">
            <Link href="/books">Go to my books</Link>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
