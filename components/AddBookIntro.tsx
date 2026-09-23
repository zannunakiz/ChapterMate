"use client"

import { motion, useReducedMotion } from "framer-motion"

export function AddBookIntro() {
  const prefersReducedMotion = useReducedMotion()
  const itemVariants = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } }
      }}
      className="mb-12 border-l border-foreground/30 pl-5 md:pl-7"
    >
      <motion.p
        variants={itemVariants}
        className="mb-4 text-xs uppercase tracking-[0.28em] text-muted-foreground"
      >
        Add your own
      </motion.p>
      <motion.h1
        variants={itemVariants}
        className="font-display text-5xl leading-[0.95] tracking-tight md:text-7xl"
      >
        Add a new book.
      </motion.h1>
      <motion.p
        variants={itemVariants}
        className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground"
      >
        Upload a book and choose the voice that will guide your next
        conversation.
      </motion.p>
    </motion.div>
  )
}
