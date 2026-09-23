"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Books", href: "/books" },
]

const brand = "ChapterMate"

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const { isLoaded, isSignedIn } = useAuth()
  const prefersReducedMotion = useReducedMotion()
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const pathname = usePathname()

  const linkClassName = (href: string, mobile = false) =>
    `group relative inline-flex w-fit items-center ${mobile ? "text-base" : "text-sm"} ${pathname === href ? "text-foreground" : "text-foreground/70"} ${isNavigating ? "pointer-events-none cursor-not-allowed opacity-50" : ""} transition-colors hover:text-foreground`

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setIsHeaderVisible(
        currentScrollY < 24 || currentScrollY < lastScrollY.current,
      )
      lastScrollY.current = currentScrollY
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={false}
      animate={
        prefersReducedMotion
          ? { y: 0, opacity: 1 }
          : { y: isHeaderVisible ? 0 : -120, opacity: isHeaderVisible ? 1 : 0 }
      }
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6"
    >
      <nav className="mx-auto max-w-[1200px] rounded-2xl border border-foreground/10 bg-background/80 shadow-lg backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5 lg:px-7">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-foreground"
          >
            {brand}
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsNavigating(true)}
                className={linkClassName(link.href)}
              >
                {link.name}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ease-out ${pathname === link.href ? "w-full" : "w-0 group-hover:w-full"}`}
                />
              </a>
            ))}
            {isLoaded && isSignedIn && (
              <a
                href="/books/add"
                onClick={() => setIsNavigating(true)}
                className={linkClassName("/books/add")}
              >
                Add Book
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ease-out ${pathname === "/books/add" ? "w-full" : "w-0 group-hover:w-full"}`}
                />
              </a>
            )}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-foreground/70 hover:text-foreground"
                >
                  Log in
                </Button>
              </SignInButton>
            )}
            {isLoaded && isSignedIn && <UserButton />}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="cursor-pointer p-2 text-foreground md:hidden"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-foreground/10 px-5 py-5 md:hidden">
            <div className="flex flex-col gap-5">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => {
                    setIsNavigating(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className={linkClassName(link.href, true)}
                >
                  {link.name}
                  <span
                    className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ease-out ${pathname === link.href ? "w-full" : "w-0 group-hover:w-full"}`}
                  />
                </a>
              ))}
              {isLoaded && isSignedIn && (
                <a
                  href="/books/add"
                  onClick={() => {
                    setIsNavigating(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className={linkClassName("/books/add", true)}
                >
                  Add Book
                  <span
                    className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ease-out ${pathname === "/books/add" ? "w-full" : "w-0 group-hover:w-full"}`}
                  />
                </a>
              )}
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <Button
                    className="w-full rounded-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Log in
                  </Button>
                </SignInButton>
              )}
              {isLoaded && isSignedIn && <UserButton />}
            </div>
          </div>
        )}
      </nav>
    </motion.header>
  )
}
