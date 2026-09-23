const VAPI_API_BASE = 'https://api.vapi.ai'

/** Assistant used for browser voice calls (public value). */
export const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID

/** Public key used by the Vapi browser SDK (safe to expose). */
export const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY

/**
 * Private key used for server-side REST calls. Unlike the public key it must
 * never reach the browser, so it is intentionally not prefixed with
 * `NEXT_PUBLIC_`.
 */
export function getVapiPrivateKey(): string | undefined {
  const key = process.env.VAPI_PRIVATE_API_KEY?.trim()
  return key || undefined
}

export function isVapiConfigured(): boolean {
  return Boolean(getVapiPrivateKey() ?? VAPI_PUBLIC_KEY)
}

export interface VapiPingResult {
  ok: boolean
  httpStatus: number
}

/**
 * Server-side Vapi connection check.
 *
 * Listing assistants is the request the Vapi docs recommend for verifying a
 * private API key. Public keys only authenticate the browser SDK, so a `401`
 * here normally means `VAPI_PRIVATE_API_KEY` has not been configured.
 */
export async function pingVapi(): Promise<VapiPingResult> {
  const key = getVapiPrivateKey() ?? VAPI_PUBLIC_KEY

  if (!key) {
    throw new Error('VAPI_PRIVATE_API_KEY is not configured')
  }

  const response = await fetch(`${VAPI_API_BASE}/assistant?limit=1`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })

  return { ok: response.ok, httpStatus: response.status }
}
