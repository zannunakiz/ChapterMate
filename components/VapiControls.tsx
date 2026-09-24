"use client"

import { useReducedMotion } from "framer-motion"
import { Mic, Square } from "lucide-react"
import { Navigation } from "@/components/landing/navigation"
import { Transcript, type TranscriptMessage } from "@/components/Transcript"
import useVapi, { type CallStatus } from "@/hooks/useVapi"
import { bookCoverUrl } from "@/lib/constants"
import { cn, formatDuration, getVoice } from "@/lib/utils"
import type { IBook } from "@/types"

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Ready",
  connecting: "Connecting",
  starting: "Starting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking"
}

export function VapiControls({ book }: { book: IBook }) {
  const prefersReducedMotion = useReducedMotion()
  const {
    status,
    isActive,
    messages,
    currentMessage,
    currentUserMessage,
    duration,
    start,
    stop,
    limitError
  } = useVapi(book)

  const transcriptMessages: TranscriptMessage[] = messages.map((message) => ({
    ...message,
    role: message.role as TranscriptMessage["role"]
  }))

  const voice = getVoice(book.persona)
  const coverSrc = book.coverURL ? bookCoverUrl(book, 320, 480) : undefined
  const showPing =
    !prefersReducedMotion &&
    isActive &&
    (status === "speaking" || status === "thinking")

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navigation />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-pink-900/10 blur-[110px]" />
        <div className="absolute -right-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full border border-foreground/[0.06]" />
        <div className="absolute left-0 top-[42%] h-px w-full bg-foreground/[0.06]" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-28 md:px-8 lg:pt-36">
        <p className="mb-6 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Talking session
        </p>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start lg:gap-8">
          <section className="rounded-3xl border border-foreground/20 bg-foreground/[0.02] p-6 sm:p-7">
            <div className="flex items-start gap-5 lg:flex-col lg:items-stretch">
              <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl border border-foreground/20 bg-muted lg:w-full">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={`Cover of ${book.title}`}
                    loading="lazy"
                    className="h-full w-full object-cover grayscale-[15%]"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 lg:pt-1">
                <h1 className="font-display text-2xl leading-tight tracking-tight lg:text-3xl">
                  {book.title}
                </h1>
                <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                  {book.author}
                </p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <Mic className="size-3" />
                  {voice.name}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-foreground/15 pt-5">
              <span className="inline-flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full",
                    isActive
                      ? "animate-pulse bg-foreground"
                      : "bg-muted-foreground/50"
                  )}
                />
                <span className="text-foreground/80">
                  {STATUS_LABEL[status]}
                </span>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatDuration(duration)}
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="relative">
                {showPing && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-full bg-foreground/15"
                  />
                )}
                <button
                  type="button"
                  onClick={isActive ? stop : start}
                  disabled={status === "connecting"}
                  aria-label={
                    isActive ? "Stop conversation" : "Start conversation"
                  }
                  aria-pressed={isActive}
                  className={cn(
                    "relative flex size-[68px] items-center justify-center rounded-full border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50",
                    isActive
                      ? "border-foreground bg-foreground text-background hover:bg-foreground/85"
                      : "border-foreground/30 bg-background text-foreground hover:border-foreground/60"
                  )}
                >
                  {isActive ? (
                    <Square className="size-5" />
                  ) : (
                    <Mic className="size-6" />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              {isActive
                ? "Tap to end the conversation."
                : "Tap the mic to start talking about this book."}
            </p>

            {limitError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
              >
                {limitError}
              </p>
            )}
          </section>

          <section className="flex h-[60vh] min-h-[380px] flex-col overflow-hidden rounded-3xl border border-foreground/20 bg-foreground/[0.02] lg:h-[600px]">
            <div className="flex items-center justify-between gap-3 border-b border-foreground/15 px-5 py-4 sm:px-6">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Conversation
              </p>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {transcriptMessages.length} turns
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              <Transcript
                messages={transcriptMessages}
                currentMessage={currentMessage}
                currentUserMessage={currentUserMessage}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default VapiControls
