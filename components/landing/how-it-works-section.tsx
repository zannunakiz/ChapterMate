"use client"

import { Upload, BookOpen, Mic2, MessageCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Bring your book",
    description:
      "Upload a PDF from your own shelf, or choose a title from the ChapterMate library.",
  },
  {
    icon: BookOpen,
    number: "02",
    title: "Pick a perspective",
    description:
      "Choose the book you want to explore and give your AI companion the context it needs.",
  },
  {
    icon: Mic2,
    number: "03",
    title: "Start talking",
    description:
      "Connect through natural voice conversations powered by VAPI. Ask anything that comes to mind.",
  },
  {
    icon: MessageCircle,
    number: "04",
    title: "Go deeper",
    description:
      "Unpack themes, characters, plot twists, and ideas with an always-ready reading companion.",
  },
]

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.15 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="how-it-works"
      data-scroll-section
      ref={ref}
      className="relative border-t border-border bg-background py-28 lg:py-40"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-20 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <span className="mb-6 inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <span className="h-px w-12 bg-foreground/30" />
              How it works
            </span>
            <h2
              className={`font-display text-5xl leading-[0.92] tracking-tight transition-all duration-1000 md:text-6xl lg:text-[120px] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
            >
              Read with
              <br />
              <span className="text-muted-foreground">curiosity.</span>
            </h2>
          </div>
          <p className="max-w-md text-base md:text-lg lg:text-xl leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9">
            From a saved PDF to a thoughtful voice conversation in a few simple
            steps.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <article
                key={step.number}
                className="group bg-background p-8 transition-all duration-500 hover:-translate-y-1 hover:bg-muted/40 hover:shadow-[0_18px_40px_-28px_rgba(255,255,255,0.45)] lg:min-h-[280px]"
              >
                <div className="mb-16 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {step.number}
                  </span>
                  <Icon
                    className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="mb-4 font-display text-2xl">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function LibrarySection() {
  return (
    <section
      id="library"
      data-scroll-section
      className="border-t border-border bg-muted/20 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <span className="mb-6 inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <span className="h-px w-12 bg-foreground/30" />
              Your reading room
            </span>
            <h2 className="font-display text-5xl leading-[0.92] tracking-tight md:text-6xl lg:text-8xl">
              One home
              <br />
              <span className="text-muted-foreground">for every story.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <div className="group border border-border bg-background p-8 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/30 hover:shadow-[0_24px_60px_-36px_rgba(255,255,255,0.45)]">
              <div className="mb-8 flex items-center justify-between border-b border-border pb-5">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  ChapterMate library
                </span>
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="space-y-5 font-display text-2xl">
                <div className="flex items-center justify-between transition-transform duration-300 group-hover:translate-x-1">
                  <span>Upload a PDF</span>
                  <Upload className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-5">
                  <span>Explore curated books</span>
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-5">
                  <span>Keep every conversation</span>
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
