// Mirrors OldVersion's UploadSchema so /books/add validates identically.
import { z } from "zod"
import {
  BOOK_AUTHOR_MAX_LENGTH,
  BOOK_TITLE_MAX_LENGTH,
} from "@/lib/book-validation"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "@/lib/upload-constants"

export const UploadSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(BOOK_TITLE_MAX_LENGTH, "Title must be 20 characters or fewer"),
  author: z
    .string()
    .min(1, "Author name is required")
    .max(BOOK_AUTHOR_MAX_LENGTH, "Author name must be 20 characters or fewer"),
  persona: z.string().min(1, "Please select a voice"),
  pdfFile: z
    .instanceof(File, { message: "PDF file is required" })
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "File size must be less than 50MB",
    )
    .refine(
      (file) =>
        ACCEPTED_PDF_TYPES.includes(
          file.type as (typeof ACCEPTED_PDF_TYPES)[number],
        ),
      "Only PDF files are accepted",
    ),
  coverImage: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_IMAGE_SIZE,
      "Image size must be less than 10MB",
    )
    .refine(
      (file) =>
        !file ||
        ACCEPTED_IMAGE_TYPES.includes(
          file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
        ),
      "Only .jpg, .jpeg, .png and .webp formats are supported",
    ),
})

export type UploadFormValues = z.infer<typeof UploadSchema>
