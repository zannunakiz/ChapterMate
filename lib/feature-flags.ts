/**
 * Server-only feature flag helpers.
 *
 * These read plain (non `NEXT_PUBLIC_`) environment variables, so only call
 * them from server components, route handlers or server actions and pass the
 * result down to client components as a prop.
 */

/** Accepts true/1/yes/on (case-insensitive). Anything else counts as false. */
export function isFeatureEnabled(
  value: string | undefined,
  fallback = false,
): boolean {
  const normalized = value?.trim().toLowerCase()

  if (normalized === undefined || normalized === '') return fallback

  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  )
}

/**
 * FF_DUMMY_BOOKS — serve the bundled sample books from `lib/constants` instead
 * of the database.
 *
 * The database path is not implemented yet, so this defaults to enabled to keep
 * the page working; set FF_DUMMY_BOOKS=false to render the placeholder instead.
 */
export function isDummyBooksEnabled(): boolean {
  return isFeatureEnabled(process.env.FF_DUMMY_BOOKS, true)
}

/**
 * FF_DUMMY_FORM — pretend the upload/save flow succeeded instead of writing the
 * book to the database.
 *
 * The database path is not implemented yet, so this defaults to enabled; set
 * FF_DUMMY_FORM=false to show the placeholder toast instead.
 */
export function isDummyFormEnabled(): boolean {
  return isFeatureEnabled(process.env.FF_DUMMY_FORM, true)
}
