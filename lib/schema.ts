import { z } from "zod"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "@/lib/upload-constants"

const fileSchema = z.custom<File>(
  (value) => typeof File === "undefined" || value instanceof File,
)

export const UploadSchema = z.object({
  pdfFile: fileSchema
    .refine(
      (file) =>
        ACCEPTED_PDF_TYPES.includes(
          file.type as (typeof ACCEPTED_PDF_TYPES)[number],
        ) || file.name.toLowerCase().endsWith(".pdf"),
      "Please upload a valid PDF file (.pdf).",
    )
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "File is too large. Maximum size is 50MB.",
    ),
  coverImage: fileSchema
    .optional()
    .refine(
      (file) =>
        !file ||
        ACCEPTED_IMAGE_TYPES.includes(
          file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
        ),
      "Please upload a valid image file.",
    )
    .refine(
      (file) => !file || file.size <= MAX_IMAGE_SIZE,
      "Image is too large. Maximum size is 10MB.",
    ),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(25, "Title must be 25 characters or fewer"),
  author: z
    .string()
    .trim()
    .min(1, "Author name is required")
    .max(25, "Author name must be 25 characters or fewer"),
  persona: z.enum(["Dave", "Daniel", "Chris", "Rachel", "Sarah"], {
    required_error: "Please select a voice",
  }),
})

export type UploadFormValues = z.infer<typeof UploadSchema>
