"use client"

import { ArrowUpRight, Github, Instagram, Mail } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

type FooterLink = {
  name: string
  href: string
  badge?: string
}

const footerLinks: Record<string, FooterLink[]> = {
  ChapterMate: [
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#how-it-works" },
    { name: "Book library", href: "#library" },
    { name: "Voice agents", href: "#voice" },
  ],
  Connect: [
    { name: "Email", href: "mailto:richky.abednego@gmail.com" },
    { name: "GitHub", href: "https://github.com/zannunakiz" },
    { name: "Instagram", href: "https://www.instagram.com/richky_4srg" },
  ],
}

const socialLinks = [
  { name: "GitHub", href: "https://github.com/zannunakiz" },
  { name: "Instagram", href: "https://www.instagram.com/richky_4srg" },
  { name: "Email", href: "mailto:richky.abednego@gmail.com" },
]

const EMAIL_ADDRESS = "richky.abednego@gmail.com"

function ContactIcon({ name }: { name: string }) {
  const Icon =
    name === "Instagram" ? Instagram : name === "GitHub" ? Github : Mail

  return <Icon aria-hidden="true" className="size-3.5 shrink-0" />
}

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL_ADDRESS)
    toast.success("Email copied to clipboard")
  } catch {
    toast.error("Could not copy email. Please try again.")
  }
}

function AnimatedWaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener("resize", resize)

    const animate = () => {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      ctx.clearRect(0, 0, width, height)

      ctx.strokeStyle = "rgba(100, 200, 150, 0.3)"
      ctx.lineWidth = 1

      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath()
        for (let x = 0; x <= width; x += 5) {
          const y =
            height * 0.5 +
            Math.sin(x * 0.01 + time + wave * 0.5) * 30 +
            Math.sin(x * 0.02 + time * 1.5 + wave) * 20
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      time += 0.02
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

export function FooterSection() {
  return (
    <footer data-scroll-section className="relative bg-black">
      {/* Panoramic banner image */}
      <div className="relative w-full h-[340px] md:h-[420px] overflow-hidden">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2810%29-UnDKstODkIENp5xqTYUEpt0Sm8tNOw.png"
          alt="Bioluminescent landscape"
          className="w-full h-full object-cover object-center"
        />
        {/* Gradient fade to black at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
        {/* Subtle dark vignette on sides */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
      </div>

      {/* Footer content — black background, white text */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-16 lg:py-20">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <a href="#" className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display text-white">
                  ChapterMate
                </span>
              </a>

              <p className="text-white/50 leading-relaxed mb-8 max-w-xs text-sm">
                Your AI-powered companion for deeper, more engaging book
                conversations.
              </p>

              {/* Social Links */}
              <div className="flex gap-6">
                {socialLinks.map((link) => (
                  link.name === "Email" ? (
                    <button
                      key={link.name}
                      type="button"
                      onClick={copyEmail}
                      className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1 group"
                    >
                      <ContactIcon name={link.name} />
                      {link.name}
                    </button>
                  ) : (
                    <a
                      key={link.name}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1 group"
                    >
                      <ContactIcon name={link.name} />
                      {link.name}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  )
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-sm font-medium text-white mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      {title === "Connect" && link.name === "Email" ? (
                        <button
                          type="button"
                          onClick={copyEmail}
                          className="text-sm text-white/40 hover:text-white transition-colors inline-flex items-center gap-2"
                        >
                          <ContactIcon name={link.name} />
                          {link.name}
                        </button>
                      ) : (
                        <a
                          href={link.href}
                          target={title === "Connect" ? "_blank" : undefined}
                          rel={title === "Connect" ? "noopener noreferrer" : undefined}
                          className="text-sm text-white/40 hover:text-white transition-colors inline-flex items-center gap-2"
                        >
                          {title === "Connect" && <ContactIcon name={link.name} />}
                          {link.name}
                          {"badge" in link && link.badge && (
                            <span className="text-xs px-2 py-0.5 bg-white text-black rounded-full">
                              {link.badge}
                            </span>
                          )}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/30">
            &copy; 2026 ChapterMate. Built for curious readers.
          </p>

          <div className="flex items-center gap-4 text-sm text-white/30">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#eca8d6]" />
              Powered by VAPI voice AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
