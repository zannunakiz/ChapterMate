"use client"

import { animate, useReducedMotion } from "framer-motion"
import { useEffect, type ReactNode } from "react"

type ScrollRevealSectionsProps = {
  children: ReactNode
}

export function ScrollRevealSections({ children }: ScrollRevealSectionsProps) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-section]"),
    )
    const cleanups = sections.map((section) => {
      const elements = Array.from(
        section.querySelectorAll<HTMLElement>(
          "h1, h2, h3, h4, p, span, article, a, button, img, svg, [data-reveal]",
        ),
      )
      const targets = elements.filter(
        (element) => !element.closest("[data-reveal-ignore]"),
      )
      const initial = new Map(
        targets.map((element) => [
          element,
          {
            opacity: element.style.opacity,
            transform: element.style.transform,
          },
        ]),
      )

      const setVisible = (visible: boolean) => {
        targets.forEach((element, index) => {
          animate(
            element,
            visible
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 24, scale: 0.985 },
            {
              duration: visible ? 0.65 : 0.35,
              delay: visible ? index * 0.025 : 0,
              ease: [0.22, 1, 0.36, 1],
            },
          )
        })
      }

      setVisible(false)
      const observer = new IntersectionObserver(
        ([entry]) => setVisible(entry.isIntersecting),
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      )
      observer.observe(section)
      return () => {
        observer.disconnect()
        targets.forEach((element) => {
          const original = initial.get(element)
          if (original) {
            element.style.opacity = original.opacity
            element.style.transform = original.transform
          }
        })
      }
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [prefersReducedMotion])

  return <>{children}</>
}
