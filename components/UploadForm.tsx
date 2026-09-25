"use client"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { UploadSchema, type UploadFormValues } from "@/lib/schema"
import {
  BOOK_AUTHOR_MAX_LENGTH,
  BOOK_TITLE_MAX_LENGTH,
} from "@/lib/book-validation"
import { type VoiceKey } from "@/lib/constants"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES
} from "@/lib/upload-constants"
import {
  checkBookExist,
  createBook,
  saveBookSegments
} from "@/lib/actions/book.action"
import { parsePDFFile } from "@/lib/utils"
import { useAuth } from "@clerk/nextjs"
import { upload } from "@vercel/blob/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, useReducedMotion } from "framer-motion"
import { FileText, ImagePlus, Mic2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

// `key` is the canonical value persisted as Book.persona (see voiceOptions in
// lib/constants.ts); `name` is only for display. Keep them in sync.
const voices: ReadonlyArray<{
  group: string
  options: ReadonlyArray<{
    key: VoiceKey
    name: string
    description: string
  }>
}> = [
  {
    group: "Male Voices",
    options: [
      { key: "dave", name: "Dave", description: "Deep, warm, and steady" },
      { key: "daniel", name: "Daniel", description: "Clear, confident, and articulate" },
      { key: "chris", name: "Chris", description: "Bright, energetic, and friendly" }
    ]
  },
  {
    group: "Female Voices",
    options: [
      { key: "rachel", name: "Rachel", description: "Soft, soothing, and melodic" },
      { key: "sarah", name: "Sarah", description: "Warm, expressive, and engaging" }
    ]
  }
]

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// How long the success toast stays on screen before we navigate to /books.
const SUCCESS_REDIRECT_DELAY_MS = 2000

/**
 * Server actions report failures as `{ error }`, which can be an Error, a
 * Mongoose error object or a plain string (see saveBookSegments), and the Blob
 * client throws — this normalises all of them into one readable line.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error.trim() || fallback

  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === "string" && message.trim()) return message
  }

  return fallback
}

/** Mongo's unique-index violation (E11000), i.e. that slug is already taken. */
function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false
  return (error as { code?: unknown }).code === 11000
}

/** Duplicate titles are a failure: stay on the page, never redirect. */
function notifyDuplicateTitle(title: string) {
  toast.error(
    `A book titled "${title}" already exists. Please use a different title.`
  )
}

function truncateFileName(fileName: string, maxBaseLength = 15) {
  const extensionIndex = fileName.lastIndexOf(".")
  const hasExtension = extensionIndex > 0
  const baseName = hasExtension ? fileName.slice(0, extensionIndex) : fileName
  const extension = hasExtension ? fileName.slice(extensionIndex) : ""

  return baseName.length > maxBaseLength
    ? `${baseName.slice(0, maxBaseLength)}...${extension}`
    : fileName
}

function FileSummary({
  file,
  onRemove,
  disabled
}: {
  file?: File
  onRemove: () => void
  disabled?: boolean
}) {
  if (!file) return null
  const displayName = truncateFileName(file.name)

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p title={file.name} className="truncate text-[13px] text-foreground lg:text-sm">
            {displayName}
          </p>
          <p className="text-[11px] text-muted-foreground lg:text-xs">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

type UploadFormProps = {
  /** FF_DUMMY_FORM, read on the server and passed down as a prop. */
  dummyForm: boolean
}

export default function UploadForm({ dummyForm }: UploadFormProps) {
  const router = useRouter()
  const { userId } = useAuth()
  const prefersReducedMotion = useReducedMotion()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [resetToken, setResetToken] = useState(0)
  const form = useForm<UploadFormValues>({
    resolver: zodResolver(UploadSchema),
    defaultValues: {
      title: "",
      author: "",
      persona: "",
      pdfFile: undefined,
      coverImage: undefined
    }
  })
  // React Hook Form owns the submit lifecycle, so this also covers validation.
  const { isSubmitting } = form.formState
  // Held true from the success toast until the redirect lands, so the form stays
  // locked while we are on our way to /books.
  const [isRedirecting, setIsRedirecting] = useState(false)
  const submitting = isSubmitting || isRedirecting

  const setFile = (field: "pdfFile" | "coverImage", file?: File) => {
    form.setValue(field, file, { shouldDirty: true, shouldValidate: true })
  }

  // The file inputs are uncontrolled, so form.reset() alone leaves their native
  // value behind; bumping the token clears them after a successful submit.
  useEffect(() => {
    if (resetToken === 0) return
    if (pdfInputRef.current) pdfInputRef.current.value = ""
    if (coverInputRef.current) coverInputRef.current.value = ""
  }, [resetToken])

  const submit = async (data: UploadFormValues) => {
    // Belt and braces: the submit button is disabled, but Enter can re-submit.
    if (submitting) return

    // FF_DUMMY_FORM on: pretend the upload and save succeeded, then clear. This
    // dev-only path deliberately stays on the page — there is no real book to
    // show in /books.
    if (dummyForm) {
      void data
      await new Promise((resolve) => setTimeout(resolve, 500))
      toast.success("dummy submit success")
      form.reset()
      setResetToken((token) => token + 1)
      return
    }

    if (!userId) {
      toast.error("You need to log in")
      return
    }

    try {
      // 1. Same title/slug already saved? A duplicate is a failure, so stay on
      // this page and let the user correct the title.
      const existsCheck = await checkBookExist(data.title)

      if (existsCheck?.error) {
        // The lookup itself failed (e.g. the database is unreachable): abort
        // rather than upload a book we could not verify.
        toast.error(
          `Could not check for an existing book: ${getErrorMessage(existsCheck.error, "please try again.")}`
        )
        return
      }

      if (existsCheck?.exists && existsCheck.book) {
        notifyDuplicateTitle(data.title)
        return
      }

      // 2. Read the PDF: searchable segments plus a page-1 cover.
      const fileTitle = data.title.replace(/\s+/g, "-").toLowerCase()
      const parsedPDF = await parsePDFFile(data.pdfFile)

      if (parsedPDF.content.length === 0) {
        toast.error("Failed parsing pdf, try different file!")
        return
      }

      // 3. Upload the book PDF.
      const uploadedPdfBlob = await upload(fileTitle, data.pdfFile, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf"
      })

      // 4. Cover: the chosen image, otherwise the PDF's first page.
      let coverUrl: string

      if (data.coverImage) {
        const uploadedCoverBlob = await upload(
          `${fileTitle}-cover.jpg`,
          data.coverImage,
          {
            access: "public",
            handleUploadUrl: "/api/upload/cover",
            contentType: data.coverImage.type
          }
        )
        coverUrl = uploadedCoverBlob.url
      } else {
        const response = await fetch(parsedPDF.cover)
        const coverBlob = await response.blob()
        const uploadedCoverBlob = await upload(
          `${fileTitle}-cover.png`,
          coverBlob,
          {
            access: "public",
            handleUploadUrl: "/api/upload/cover",
            contentType: "image/jpeg"
          }
        )
        coverUrl = uploadedCoverBlob.url
      }

      // 5. Save the book record.
      const bookResult = await createBook({
        clerkId: userId,
        title: data.title,
        author: data.author,
        persona: data.persona,
        fileURL: uploadedPdfBlob.url,
        fileBlobKey: uploadedPdfBlob.pathname,
        coverURL: coverUrl,
        fileSize: data.pdfFile.size
      })

      // The slug may have been claimed between the check in step 1 and here.
      if (bookResult.alreadyExists) {
        notifyDuplicateTitle(data.title)
        return
      }

      if (!bookResult.success || !bookResult.data) {
        toast.error(
          `Failed to save the book: ${getErrorMessage(bookResult.error, "unexpected error, please try again.")}`
        )
        return
      }

      // 6. Save the searchable segments.
      const segmentsResult = await saveBookSegments(
        String(bookResult.data._id),
        userId,
        parsedPDF.content
      )

      if (!segmentsResult.success) {
        toast.error(
          `Failed to save the book content: ${getErrorMessage(segmentsResult.error, "unexpected error, please try again.")}`
        )
        return
      }

      // 7. Success: confirm, then leave the toast on screen for a moment before
      // handing the user over to their library.
      setIsRedirecting(true)
      toast.success("Book added successfully")
      form.reset()
      setResetToken((token) => token + 1)
      await new Promise((resolve) =>
        setTimeout(resolve, SUCCESS_REDIRECT_DELAY_MS)
      )
      router.push("/books")
    } catch (error) {
      // Unique-index violation on `slug`: the title was taken by a parallel
      // submit after the checks above, so it is still just a failed upload.
      if (isDuplicateKeyError(error)) {
        notifyDuplicateTitle(data.title)
        return
      }

      toast.error(
        `Failed to add the book: ${getErrorMessage(error, "unexpected error, please try again.")}`
      )
    }
  }

  const formItemVariants = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
  const formVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } }
  }

  return (
    <Form {...form}>
      <motion.form
        initial={prefersReducedMotion ? false : "hidden"}
        animate="visible"
        variants={formVariants}
        onSubmit={form.handleSubmit(submit)}
        className="space-y-8 max-lg:[&_[data-slot=form-description]]:text-[13px] max-lg:[&_[data-slot=form-label]]:text-[13px] max-lg:[&_[data-slot=form-message]]:text-[13px] max-lg:[&_[data-slot=input]]:text-[13px] max-lg:[&_[data-slot=button]]:text-[13px]"
      >
        <motion.div variants={formItemVariants}>
          {" "}
          <FormField
            control={form.control}
            name="pdfFile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Book PDF</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept={ACCEPTED_PDF_TYPES.join(",")}
                      className="sr-only"
                      onChange={(event) =>
                        setFile("pdfFile", event.target.files?.[0])
                      }
                    />
                    <button
                      data-form-item
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={submitting}
                      className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-foreground/20 px-5 py-6 text-left transition-colors hover:border-foreground/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Upload className="size-5 text-muted-foreground" />
                      <span>
                        <span className="block text-[13px] lg:text-sm">
                          PDF file (max 10MB)
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground lg:text-xs">
                          Choose a PDF to begin
                        </span>
                      </span>
                    </button>
                    <FileSummary
                      file={field.value}
                      disabled={submitting}
                      onRemove={() => {
                        setFile("pdfFile", undefined)
                        if (pdfInputRef.current) pdfInputRef.current.value = ""
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
        <motion.div variants={formItemVariants}>
          <FormField
            control={form.control}
            name="coverImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Book Cover</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      className="sr-only"
                      onChange={(event) =>
                        setFile("coverImage", event.target.files?.[0])
                      }
                    />
                    <button
                      data-form-item
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={submitting}
                      className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-foreground/20 px-5 py-6 text-left transition-colors hover:border-foreground/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ImagePlus className="size-5 text-muted-foreground" />
                      <span>
                        <span className="block text-[13px] lg:text-sm">Book Cover</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground lg:text-xs">
                          Leave empty to auto-generate from PDF (max 1MB)
                        </span>
                      </span>
                    </button>
                    <FileSummary
                      file={field.value}
                      disabled={submitting}
                      onRemove={() => {
                        setFile("coverImage", undefined)
                        if (coverInputRef.current)
                          coverInputRef.current.value = ""
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
        <motion.div
          variants={formItemVariants}
          className="grid gap-8 md:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <div>
                    <Input
                      maxLength={BOOK_TITLE_MAX_LENGTH}
                      disabled={submitting}
                      placeholder="ex: Rich Dad Poor Dad"
                      {...field}
                    />
                    <p className="mt-1.5 text-right text-[10px] tabular-nums text-muted-foreground lg:text-[11px]">
                      {field.value.length}/{BOOK_TITLE_MAX_LENGTH}
                    </p>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Author Name</FormLabel>
                <FormControl>
                  <div>
                    <Input
                      maxLength={BOOK_AUTHOR_MAX_LENGTH}
                      disabled={submitting}
                      placeholder="ex: Robert Kiyosaki"
                      {...field}
                    />
                    <p className="mt-1.5 text-right text-[10px] tabular-nums text-muted-foreground lg:text-[11px]">
                      {field.value.length}/{BOOK_AUTHOR_MAX_LENGTH}
                    </p>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
        <motion.div variants={formItemVariants}>
          <FormField
            control={form.control}
            name="persona"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Choose Assistant Voice</FormLabel>
                <FormDescription>
                  Choose how your reading companion should sound.
                </FormDescription>
                <FormControl>
                  <div data-form-item className="space-y-5">
                    {voices.map((group) => (
                      <fieldset key={group.group}>
                        <legend className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:text-xs">
                          {group.group}
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {group.options.map((voice) => {
                            const isSelected = field.value === voice.key
                            return (
                              <button
                                key={voice.key}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => field.onChange(voice.key)}
                                disabled={submitting}
                                className={`rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-foreground bg-foreground text-background" : "border-foreground/10 hover:border-foreground/40"}`}
                              >
                                <span className="flex items-center gap-2 text-[13px] lg:text-sm">
                                  <Mic2 className="size-3.5" />
                                  {voice.name}
                                </span>
                                <span
                                  className={`mt-1 block text-[11px] lg:text-xs ${isSelected ? "text-background/70" : "text-muted-foreground"}`}
                                >
                                  {voice.description}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>
        <motion.div
          variants={formItemVariants}
          className="flex w-full justify-end"
        >
          <Button
            data-form-item
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-full sm:w-auto"
          >
            {submitting ? "Submitting..." : "Submit Book"}
          </Button>
        </motion.div>
      </motion.form>
    </Form>
  )
}
