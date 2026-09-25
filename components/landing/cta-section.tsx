"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Mic2 } from "lucide-react"
import Link from "next/link"

export function CtaSection() {
  return (
    <section
      id="voice"
      data-scroll-section
      className="relative overflow-hidden border-t border-border bg-foreground py-28 text-background transition-colors duration-700 lg:py-40"
    >
      <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full border border-background/10" />
      <div className="pointer-events-none absolute -right-8 top-24 h-56 w-56 rounded-full border border-background/10" />
      <div className="relative mx-auto max-w-350 px-6 lg:px-12">
        <div className="max-w-4xl">
          <div className="mb-8 flex items-center gap-3 font-mono text-sm text-background/60">
            <Mic2 className="h-4 w-4" />
            Powered by{" "}
            <a
              href="https://dashboard.vapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-gray-400 transition-colors"
            >
              VAPI
            </a>
          </div>
          <h2 className="font-display text-5xl leading-[0.92] tracking-tight transition-transform duration-700 md:text-7xl lg:text-[119px]">
            Your next
            <br />
            <span className="text-background/45">conversation awaits.</span>
          </h2>
          <p className="mt-10 max-w-xl text-xl leading-relaxed text-background/60">
            Turn reading into a dialogue. Ask better questions, hear new
            perspectives, and make every story stay with you longer.
          </p>
          <Button
            asChild
            className="group mt-12 rounded-none bg-background px-7 py-6 text-foreground hover:bg-background/85"
            size="lg"
          >
            <Link href="/books">
              Start reading{" "}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
