import { connectToDatabase } from '@/database/mongoose'
import { getBlobToken, pingBlob } from '@/lib/blob'
import { getVapiPrivateKey, isVapiConfigured, pingVapi } from '@/lib/vapi'

export type ServiceName = 'clerk' | 'mongodb' | 'blob' | 'vapi'
export type CheckStatus = 'ok' | 'error' | 'skipped'
export type OverallStatus = 'ok' | 'degraded' | 'error'

export interface ServiceCheck {
  status: CheckStatus
  latencyMs: number
  message: string
  httpStatus?: number
}

export interface HealthReport {
  success: boolean
  status: OverallStatus
  checkedAt: string
  durationMs: number
  services: Record<ServiceName, ServiceCheck>
}

const CLERK_API_BASE = 'https://api.clerk.com/v1'
const CHECK_TIMEOUT_MS = 6_000
const CACHE_TTL_MS = 15_000

/**
 * Env values that must never appear in a response. This endpoint is public, so
 * error text is scrubbed before it is returned.
 */
const SECRET_ENV_KEYS = [
  'CLERK_SECRET_KEY',
  'MONGODB_URI',
  'BLOB_READ_WRITE_TOKEN',
  'VAPI_PRIVATE_API_KEY',
  'NEXT_PUBLIC_VAPI_API_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
]

/**
 * Removes credentials from any text that is about to be returned to a caller.
 * Replaces known secret values first, then falls back to pattern matching so
 * unknown secrets (connection strings, bearer tokens, key prefixes) are masked.
 */
function redactSecrets(text: string): string {
  let safe = text

  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key]

    if (value && value.length >= 8) {
      safe = safe.split(value).join('***')
    }
  }

  safe = safe
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]*@/gi, '$1***@')
    .replace(/\bsk_(?:test|live)_[A-Za-z0-9]+/g, '***')
    .replace(/\bpk_(?:test|live)_[A-Za-z0-9]+/g, '***')
    .replace(/vercel_blob_[A-Za-z0-9_]+/g, '***')
    .replace(/\bstore_[A-Za-z0-9]+/g, '***')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer ***')

  return safe.length > 300 ? `${safe.slice(0, 300)}...` : safe
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Keeps a single slow service from holding the whole endpoint open. */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`${label} did not respond within ${CHECK_TIMEOUT_MS}ms`),
        ),
      CHECK_TIMEOUT_MS,
    )

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function skipped(message: string, latencyMs: number): ServiceCheck {
  return { status: 'skipped', latencyMs, message }
}

function errored(
  error: unknown,
  latencyMs: number,
  httpStatus?: number,
): ServiceCheck {
  return {
    status: 'error',
    latencyMs,
    message: redactSecrets(describeError(error)),
    ...(httpStatus === undefined ? {} : { httpStatus }),
  }
}

/** Clerk: an authenticated read of the Backend API proves the secret key works. */
async function checkClerk(): Promise<ServiceCheck> {
  const startedAt = Date.now()
  const secretKey = process.env.CLERK_SECRET_KEY

  if (!secretKey) {
    return skipped('CLERK_SECRET_KEY is not set', Date.now() - startedAt)
  }

  try {
    const response = await withTimeout(
      fetch(`${CLERK_API_BASE}/users?limit=1`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: 'no-store',
      }),
      'Clerk Backend API',
    )
    const latencyMs = Date.now() - startedAt

    if (response.ok) {
      return {
        status: 'ok',
        latencyMs,
        message: 'Clerk Backend API reachable',
        httpStatus: response.status,
      }
    }

    return {
      status: 'error',
      latencyMs,
      message: `Clerk Backend API responded with status ${response.status}`,
      httpStatus: response.status,
    }
  } catch (error) {
    return errored(error, Date.now() - startedAt)
  }
}

/** MongoDB: connect through the shared cache, then ping the server. */
async function checkMongo(): Promise<ServiceCheck> {
  const startedAt = Date.now()

  if (!process.env.MONGODB_URI) {
    return skipped('MONGODB_URI is not set', Date.now() - startedAt)
  }

  try {
    const connection = await withTimeout(connectToDatabase(), 'MongoDB')
    const db = connection.connection.db

    if (!db) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: 'MongoDB connection has no active database handle',
      }
    }

    const ping = await withTimeout(
      db.admin().command({ ping: 1 }),
      'MongoDB ping',
    )
    const latencyMs = Date.now() - startedAt

    if (ping?.ok === 1) {
      return { status: 'ok', latencyMs, message: 'MongoDB ping succeeded' }
    }

    return {
      status: 'error',
      latencyMs,
      message: 'MongoDB ping returned an unexpected result',
    }
  } catch (error) {
    return errored(error, Date.now() - startedAt)
  }
}

/** Vercel Blob: a read-only listing validates the read-write token. */
async function checkBlob(): Promise<ServiceCheck> {
  const startedAt = Date.now()

  if (!getBlobToken()) {
    return skipped('BLOB_READ_WRITE_TOKEN is not set', Date.now() - startedAt)
  }

  try {
    const result = await withTimeout(pingBlob(), 'Vercel Blob')
    const latencyMs = Date.now() - startedAt

    if (result.ok) {
      return { status: 'ok', latencyMs, message: 'Vercel Blob store reachable' }
    }

    return {
      status: 'error',
      latencyMs,
      message: 'Vercel Blob store returned an unexpected result',
    }
  } catch (error) {
    return errored(error, Date.now() - startedAt)
  }
}

/** Vapi: server-side REST call, so a private API key is required. */
async function checkVapi(): Promise<ServiceCheck> {
  const startedAt = Date.now()
  const privateKey = getVapiPrivateKey()

  if (!isVapiConfigured()) {
    return skipped('VAPI_PRIVATE_API_KEY is not set', Date.now() - startedAt)
  }

  try {
    const result = await withTimeout(pingVapi(), 'Vapi REST API')
    const latencyMs = Date.now() - startedAt

    if (result.ok) {
      return {
        status: 'ok',
        latencyMs,
        message: 'Vapi REST API reachable',
        httpStatus: result.httpStatus,
      }
    }

    const unauthorized = result.httpStatus === 401 || result.httpStatus === 403

    // Only the public browser key is available. Public keys cannot authenticate
    // server-side calls, so treat it as missing configuration, not an outage.
    if (unauthorized && !privateKey) {
      return skipped(
        'VAPI_PRIVATE_API_KEY is not set (public keys cannot authenticate server-side checks)',
        latencyMs,
      )
    }

    return {
      status: 'error',
      latencyMs,
      message: unauthorized
        ? 'Vapi rejected the private API key'
        : `Vapi REST API responded with status ${result.httpStatus}`,
      httpStatus: result.httpStatus,
    }
  } catch (error) {
    return errored(error, Date.now() - startedAt)
  }
}

let cache: { expiresAt: number; report: HealthReport } | null = null

/**
 * Pings Clerk, MongoDB, Vercel Blob and Vapi and reports each result.
 * Results are cached briefly so repeated polling cannot hammer those services.
 */
export async function runHealthChecks(): Promise<{
  report: HealthReport
  cached: boolean
}> {
  if (cache && cache.expiresAt > Date.now()) {
    return { report: cache.report, cached: true }
  }

  const startedAt = Date.now()

  const [clerk, mongodb, blob, vapi] = await Promise.all([
    checkClerk(),
    checkMongo(),
    checkBlob(),
    checkVapi(),
  ])

  const services: Record<ServiceName, ServiceCheck> = {
    clerk,
    mongodb,
    blob,
    vapi,
  }
  const statuses = Object.values(services).map((service) => service.status)

  let status: OverallStatus = 'ok'

  if (statuses.includes('error')) {
    status = 'error'
  } else if (statuses.includes('skipped')) {
    status = 'degraded'
  }

  const report: HealthReport = {
    success: status !== 'error',
    status,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    services,
  }

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, report }

  return { report, cached: false }
}
