"use client"

import { motion, useReducedMotion } from "framer-motion"
import UploadForm from "@/components/UploadForm"

type AddBookFormPanelProps = {
  /** FF_DUMMY_FORM, read on the server and passed down as a prop. */
  dummyForm: boolean
}

export function AddBookFormPanel({ dummyForm }: AddBookFormPanelProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={
        prefersReducedMotion ? false : { opacity: 0, y: 28, scale: 0.985 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-white/[0.14] bg-zinc-900/75 p-5 shadow-[0_28px_100px_-45px_rgba(255,255,255,0.45),0_35px_100px_-55px_rgba(157,23,77,0.6)] backdrop-blur-sm sm:p-8 md:p-10"
    >
      <UploadForm dummyForm={dummyForm} />
    </motion.div>
  )
}
