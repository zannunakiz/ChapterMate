"use client"

import { Mic } from "lucide-react"
import { cn } from "@/lib/utils"

export type TranscriptMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

type TranscriptProps = {
  messages: TranscriptMessage[]
  currentMessage?: string
  currentUserMessage?: string
}

function Bubble({
  content,
  isUser,
  streaming
}: {
  content: string
  isUser: boolean
  streaming?: boolean
}) {
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]",
          isUser
            ? "rounded-br-sm border-foreground/25 bg-foreground text-background"
            : "rounded-bl-sm border-foreground/20 bg-foreground/[0.03] text-foreground/90"
        )}
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {content}
        {streaming && (
          <span
            aria-hidden="true"
            className={cn(
              "ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse",
              isUser ? "bg-background/70" : "bg-foreground/60"
            )}
          />
        )}
      </p>
    </div>
  )
}

export function Transcript({
  messages,
  currentMessage,
  currentUserMessage
}: TranscriptProps) {
  const hasConversation =
    messages.length > 0 ||
    Boolean(currentMessage) ||
    Boolean(currentUserMessage)

  if (!hasConversation) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-foreground/20 bg-foreground/[0.04]">
          <Mic className="size-5 text-muted-foreground" />
        </div>
        <p className="font-display text-xl tracking-tight sm:text-2xl">
          No conversation yet
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Start the session and ask anything about this book — every reply is
          spoken out loud.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {messages.map((message, index) => {
        if (message.role === "system") return null

        return (
          <Bubble
            key={index}
            content={message.content}
            isUser={message.role === "user"}
          />
        )
      })}

      {currentUserMessage && (
        <Bubble content={currentUserMessage} isUser streaming />
      )}

      {currentMessage && (
        <Bubble content={currentMessage} isUser={false} streaming />
      )}
    </div>
  )
}

export default Transcript
