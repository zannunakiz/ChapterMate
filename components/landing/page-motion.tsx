"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { ScrollRevealSections } from "./scroll-reveal-sections"

export function PageMotion({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.main
      className="relative min-h-screen overflow-x-clip"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <ScrollRevealSections>{children}</ScrollRevealSections>
    </motion.main>
  )
}
