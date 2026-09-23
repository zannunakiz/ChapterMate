import { AddBookFormPanel } from "@/components/AddBookFormPanel"
import { AddBookIntro } from "@/components/AddBookIntro"
import { Navigation } from "@/components/landing/navigation"
import { isDummyFormEnabled } from "@/lib/feature-flags"

export default function AddBookPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navigation />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-[-18rem] h-[42rem] bg-[radial-gradient(ellipse_at_center,rgba(156,39,104,0.22),transparent_64%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-pink-900/15 blur-[100px]" />
        <div className="absolute left-[8%] top-32 h-px w-32 bg-foreground/25" />
        <div className="absolute right-[10%] top-48 h-40 w-px bg-foreground/15" />
        <div className="absolute -right-20 top-24 size-72 rounded-full border border-foreground/10" />
        <div className="absolute left-0 top-[58%] h-px w-full bg-foreground/[0.08]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-32 md:px-8 lg:pt-40">
        <AddBookIntro />
        <AddBookFormPanel dummyForm={isDummyFormEnabled()} />
      </div>
    </main>
  )
}
