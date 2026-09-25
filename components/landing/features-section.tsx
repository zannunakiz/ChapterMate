"use client"

import { useEffect, useRef, useState } from "react"

const features = [
  {
    number: "01",
    title: "Upload Your Books",
    description:
      "Add your own PDF books to your personal library. ChapterMate processes them instantly and makes them ready for AI-powered conversations.",
    stats: { value: "100% Free", label: "PDFs supported" },
  },
  {
    number: "02",
    title: "Voice AI Conversations",
    description:
      "Chat with advanced AI voice agents about any book. Discuss characters, themes, plot points, and deeper literary analysis with natural conversations.",
    stats: { value: "100+", label: "curated books" },
  },
  {
    number: "03",
    title: "AI-Powered Discussions",
    description:
      "Get intelligent insights, character analysis, thematic breakdowns, and literary interpretations powered by cutting-edge AI technology.",
    stats: { value: "24/7", label: "always available" },
  },
  {
    number: "04",
    title: "VAPI Integration",
    description:
      "Powered by VAPI for seamless voice interactions. Crystal-clear AI conversations that understand context and nuance from your books.",
    stats: { value: "Next-gen", label: "voice AI" },
  },
]

// Floating dot particles visualization
function ParticleVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
    }
    canvas.addEventListener("mousemove", handleMouseMove)

    // Generate stable particle positions
    const COUNT = 70
    const particles = Array.from({ length: COUNT }, (_, i) => {
      const seed = i * 1.618
      return {
        bx: (seed * 127.1) % 1,
        by: (seed * 311.7) % 1,
        phase: seed * Math.PI * 2,
        speed: 0.4 + (seed % 0.4),
        radius: 1.2 + (seed % 2.2),
      }
    })

    let time = 0
    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      ctx.clearRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      particles.forEach((p) => {
        const flowX = Math.sin(time * p.speed * 0.4 + p.phase) * 38
        const flowY = Math.cos(time * p.speed * 0.3 + p.phase * 0.7) * 24

        const bx = p.bx * w
        const by = p.by * h
        const dx = p.bx - mx
        const dy = p.by - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        const influence = Math.max(0, 1 - dist * 2.8)

        const x = bx + flowX + influence * Math.cos(time + p.phase) * 36
        const y = by + flowY + influence * Math.sin(time + p.phase) * 36

        const pulse = Math.sin(time * p.speed + p.phase) * 0.5 + 0.5
        const alpha = 0.08 + pulse * 0.18 + influence * 0.3

        ctx.beginPath()
        ctx.arc(x, y, p.radius + pulse * 0.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()
      })

      time += 0.016
      frameRef.current = requestAnimationFrame(render)
    }
    render()

    return () => {
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ width: "100%", height: "100%" }}
    />
  )
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const intervalId = window.setInterval(() => {
      setActiveFeature((current) => (current + 1) % features.length)
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [isVisible])

  const feature = features[activeFeature]

  return (
    <section
      id="features"
      data-scroll-section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header - Full width with diagonal layout */}
        <div className="relative mb-24 lg:mb-32">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-6 min-w-0">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
                <span className="w-12 h-px bg-foreground/30" />
                Features
              </span>
              <h2
                className={`text-[clamp(3rem,5vw,6.5rem)] font-display tracking-tight leading-[0.92] break-words transition-all duration-1000 ${isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
                  }`}
              >
                Book
                <br />
                <span className="text-muted-foreground">conversations.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:pb-4 min-w-0">
              <p
                className={`text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
                  }`}
              >
                Experience a new way to engage with books. Upload your PDFs or
                explore from our curated collection, then have intelligent
                conversations with AI voice agents.
              </p>
            </div>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Large feature card */}
          <div
            className={`lg:col-span-12 relative bg-black border border-foreground/10 min-h-[500px] overflow-hidden group transition-all duration-700 hover:border-foreground/25 hover:shadow-[0_24px_80px_-32px_rgba(255,255,255,0.32)] flex ${isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-12"
              }`}
          >
            {/* Left: text content */}
            <div className="relative flex-1 p-8 lg:p-12 bg-black">
              <ParticleVisualization />
              <div
                key={feature.number}
                className="relative z-10"
                style={{ animation: "feature-content-fade 500ms ease-in-out" }}
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {feature.number}
                </span>
                <h3 className="text-3xl lg:text-4xl font-display mt-4 mb-6 group-hover:translate-x-2 transition-transform duration-500">
                  {feature.title}
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
                  {feature.description}
                </p>
                <div>
                  <span className="text-5xl lg:text-6xl font-display">
                    {feature.stats.value}
                  </span>
                  <span className="block text-sm text-muted-foreground font-mono mt-2">
                    {feature.stats.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: mirrored image, full height */}
            <div className="hidden lg:block relative w-[42%] shrink-0 overflow-hidden">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2812%29-ng3RrNnsPMJ5CrtOjcPTmhHg01W11q.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ transform: "scaleX(-1)" }}
              />
              {/* Fade left edge into black */}
              <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes feature-content-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
