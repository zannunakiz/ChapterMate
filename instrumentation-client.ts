/**
 * Runs once in the browser, before the app is hydrated.
 *
 * `instrumentation-client.ts` is Next.js' built-in hook for client-side setup,
 * so PostHog is initialised exactly once per page load (no provider/effect can
 * run it a second time). Only the public `NEXT_PUBLIC_*` values are used — no
 * secrets and no user data are sent from here.
 *
 * `capture_pageview` is disabled on purpose: pageviews are reported by
 * `components/posthog-page-view.tsx`, which fires a single `$pageview` per App
 * Router route change (the SDK's built-in History API monitor is not started by
 * this setup, so automatic pageviews would only ever cover the initial load).
 * Keeping one source of truth prevents duplicate events.
 *
 * Docs: https://posthog.com/docs/libraries/next-js
 */
import posthog from 'posthog-js'

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

// Skip initialisation when no project token is configured (for example a local
// environment without analytics) instead of logging an SDK error in the browser.
if (projectToken) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-05-30',
    capture_pageview: false,
  })
}

