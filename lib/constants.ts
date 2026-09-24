export type Book = {
  title: string
  author: string
  slug: string
  /** Real cover stored in the database (MongoDB books). */
  coverURL?: string
  /** Bundled picsum id, used by the sample/dummy books. */
  coverId?: number
  releaseYear: number
}

/**
 * Cover image for a book: the database `coverURL` when present, otherwise the
 * bundled picsum id (sample books have no stored cover).
 */
export function bookCoverUrl(
  book: Pick<Book, "coverURL" | "coverId">,
  width: number,
  height: number,
): string {
  return (
    book.coverURL ??
    `https://picsum.photos/id/${book.coverId ?? 1}/${width}/${height}`
  )
}

export const sampleBooks: Book[] = [
  ["Pride and Prejudice", "Jane Austen", "pride-and-prejudice"],
  ["The Great Gatsby", "F. Scott Fitzgerald", "the-great-gatsby"],
  ["Jane Eyre", "Charlotte Brontë", "jane-eyre"],
  ["The Odyssey", "Homer", "the-odyssey"],
  ["Little Women", "Louisa May Alcott", "little-women"],
  ["Moby-Dick", "Herman Melville", "moby-dick"],
  ["Wuthering Heights", "Emily Brontë", "wuthering-heights"],
  ["The Picture of Dorian Gray", "Oscar Wilde", "the-picture-of-dorian-gray"],
  ["Frankenstein", "Mary Shelley", "frankenstein"],
  ["The Secret Garden", "Frances Hodgson Burnett", "the-secret-garden"],
].map(([title, author, slug], index) => ({
  title,
  author,
  slug,
  coverId: index + 1,
  releaseYear: 1813 + index * 12,
}))

export const myBooks: Book[] = [
  ["The Midnight Library", "Matt Haig", "the-midnight-library"],
  [
    "Tomorrow, and Tomorrow, and Tomorrow",
    "Gabrielle Zevin",
    "tomorrow-and-tomorrow-and-tomorrow",
  ],
  ["Klara and the Sun", "Kazuo Ishiguro", "klara-and-the-sun"],
  ["The Book Thief", "Markus Zusak", "the-book-thief"],
  ["A Man Called Ove", "Fredrik Backman", "a-man-called-ove"],
].map(([title, author, slug], index) => ({
  title,
  author,
  slug,
  coverId: index + 6,
  releaseYear: 2015 + index * 2,
}))
