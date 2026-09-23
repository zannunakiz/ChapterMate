import { motion, useReducedMotion } from "framer-motion"
import type { Book } from "@/lib/constants"

type BookCardProps = {
  book: Book
  index: number
  onSelect: (book: Book) => void
}

export function BookCard({ book, index, onSelect }: BookCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const cardVariants = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

  return (
    <motion.button
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={cardVariants}
      transition={{ duration: 0.5, delay: index * 0.06, ease: "easeOut" }}
      type="button"
      onClick={() => onSelect(book)}
      data-book-card
      className="group block cursor-pointer transition-transform duration-500 hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-foreground/10 bg-muted shadow-sm transition-all duration-500 group-hover:border-foreground/30 group-hover:shadow-[0_20px_45px_-28px_rgba(255,255,255,0.6)]">
        <img
          src={`https://picsum.photos/id/${book.coverId}/400/600`}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          className="h-full w-full object-cover grayscale-[15%] transition duration-700 group-hover:scale-105 group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
      </div>
      <div className="pt-4">
        <h2 className="font-display text-lg leading-tight tracking-tight text-foreground transition-colors group-hover:text-foreground/70">
          {book.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
      </div>
    </motion.button>
  )
}
