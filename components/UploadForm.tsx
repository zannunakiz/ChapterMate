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
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES
} from "@/lib/upload-constants"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, useReducedMotion } from "framer-motion"
import { FileText, ImagePlus, Mic2, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

const voices = [
  {
    group: "Male Voices",
    options: [
      { name: "Dave", description: "Deep, warm, and steady" },
      { name: "Daniel", description: "Clear, confident, and articulate" },
      { name: "Chris", description: "Bright, energetic, and friendly" }
    ]
  },
  {
    group: "Female Voices",
    options: [
      { name: "Rachel", description: "Soft, soothing, and melodic" },
      { name: "Sarah", description: "Warm, expressive, and engaging" }
    ]
  }
] as const

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">
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
    if (isSubmitting) return

    // FF_DUMMY_FORM is false: the real database write is not wired up yet.
    if (!dummyForm) {
      toast.error("dummy feature is set to false")
      return
    }

    // Dummy submit: pretend the upload and save succeeded, then clear the form.
    void data
    await new Promise((resolve) => setTimeout(resolve, 500))
    toast.success("dummy submit success")
    form.reset()
    setResetToken((token) => token + 1)
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
        className="space-y-8"
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
                      disabled={isSubmitting}
                      className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-foreground/20 px-5 py-6 text-left transition-colors hover:border-foreground/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Upload className="size-5 text-muted-foreground" />
                      <span>
                        <span className="block text-sm">
                          PDF file (max 50MB)
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Choose a PDF to begin
                        </span>
                      </span>
                    </button>
                    <FileSummary
                      file={field.value}
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                      className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-foreground/20 px-5 py-6 text-left transition-colors hover:border-foreground/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ImagePlus className="size-5 text-muted-foreground" />
                      <span>
                        <span className="block text-sm">Book Cover</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Leave empty to auto-generate from PDF
                        </span>
                      </span>
                    </button>
                    <FileSummary
                      file={field.value}
                      disabled={isSubmitting}
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
                      maxLength={100}
                      disabled={isSubmitting}
                      placeholder="ex: Rich Dad Poor Dad"
                      {...field}
                    />
                    <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                      {field.value.length}/100
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
                      maxLength={100}
                      disabled={isSubmitting}
                      placeholder="ex: Robert Kiyosaki"
                      {...field}
                    />
                    <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                      {field.value.length}/100
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
                        <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {group.group}
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {group.options.map((voice) => (
                            <button
                              key={voice.name}
                              type="button"
                              aria-pressed={field.value === voice.name}
                              onClick={() => field.onChange(voice.name)}
                              disabled={isSubmitting}
                              className={`rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${field.value === voice.name ? "border-foreground bg-foreground text-background" : "border-foreground/10 hover:border-foreground/40"}`}
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <Mic2 className="size-3.5" />
                                {voice.name}
                              </span>
                              <span
                                className={`mt-1 block text-xs ${field.value === voice.name ? "text-background/70" : "text-muted-foreground"}`}
                              >
                                {voice.description}
                              </span>
                            </button>
                          ))}
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
        <motion.div variants={formItemVariants}
          className="flex w-full justify-end"
        >
          <Button
            data-form-item
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-full sm:w-auto"
          >
            {isSubmitting ? "Submitting..." : "Submit Book"}
          </Button>
        </motion.div>
      </motion.form>
    </Form>
  )
}
