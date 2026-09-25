'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import posthog from 'posthog-js'

/**
 * Reports one PostHog `$pageview` per App Router route change.
 *
 * PostHog is initialised with `capture_pageview: false` (see
 * `instrumentation-client.ts`), which makes this component the single source of
 * pageviews: it captures the initial page and captures again whenever the path
 * or the query string changes, so client-side (soft) navigations, back/forward
 * and link clicks are all covered.
 *
 * It is rendered inside a Suspense boundary in the root layout because
 * `useSearchParams` suspends while the app shell renders.
 */

// Last URL reported to PostHog. React runs effects twice in development and a
// remount can replay the same URL, so identical consecutive URLs are skipped to
// keep exactly one pageview per route.
let lastCapturedUrl: string | undefined

export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // No project token -> PostHog was never initialised, so stay silent.
    if (!posthog.__loaded) return

    const query = searchParams?.toString()
    // A session path is derived from a book title, so the slug is masked before
    // it reaches analytics: private book titles must not leave the app.
    const SESSION_PREFIX = '/books/session/'
    const safePath = pathname.startsWith(SESSION_PREFIX) ? `${SESSION_PREFIX}[slug]` : pathname
    const url = `${window.location.origin}${safePath}${query ? `?${query}` : ''}`

    if (url === lastCapturedUrl) return
    lastCapturedUrl = url

    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}
