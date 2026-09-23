import { list } from '@vercel/blob'

export function getBlobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  return token || undefined
}

export interface BlobPingResult {
  ok: boolean
  blobCount: number
}

/**
 * Server-side Vercel Blob connection check.
 *
 * A single-item `list()` round-trip proves the read-write token is valid
 * without creating or mutating anything in the store.
 */
export async function pingBlob(): Promise<BlobPingResult> {
  const token = getBlobToken()

  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }

  const result = await list({ token, limit: 1 })

  return { ok: true, blobCount: result.blobs.length }
}
