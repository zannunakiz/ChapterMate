/**
 * Read-only diagnostic: prints every book with the `persona` the upload form
 * saved and the voice the session page will actually use.
 *
 *   npm run db:check-voices
 *
 * Expected output after picking a voice in the form:
 *   persona="dave" (key)          -> Dave (CYw3kZ02Hs0563khs1Fj)
 * Books uploaded before the fix stored the display name instead:
 *   persona="Dave" (voice name)   -> Dave (CYw3kZ02Hs0563khs1Fj)
 */
import nextEnv from "@next/env"
import dns from "node:dns"
import mongoose from "mongoose"

// Plain constants module (no imports), so Node can read the .ts file directly.
import { DEFAULT_VOICE, voiceOptions } from "../lib/constants.ts"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

// Mirrors getVoiceKey() in lib/utils.ts — keep the two in sync.
const voiceKeys = new Set(Object.keys(voiceOptions))
const voiceKeyByDisplayName = new Map(
  Object.entries(voiceOptions).map(([key, voice]) => [voice.name.toLowerCase(), key]),
)

function resolveVoiceKey(persona) {
  if (!persona) return DEFAULT_VOICE

  const trimmed = String(persona).trim()
  const normalized = trimmed.toLowerCase()

  if (voiceKeys.has(normalized)) return normalized

  const keyByName = voiceKeyByDisplayName.get(normalized)
  if (keyByName) return keyByName

  const keyById = Object.entries(voiceOptions).find(([, voice]) => voice.id === trimmed)

  return keyById ? keyById[0] : DEFAULT_VOICE
}

function describePersona(persona) {
  if (persona == null || persona === "") return "missing -> fallback"

  const trimmed = String(persona).trim()
  const normalized = trimmed.toLowerCase()

  if (voiceKeys.has(normalized)) return "canonical key"
  if (voiceKeyByDisplayName.has(normalized)) return "display name"
  if (Object.values(voiceOptions).some((voice) => voice.id === trimmed)) return "elevenlabs voice id"

  return "UNKNOWN -> fallback"
}

async function configureDnsFallback() {
  try {
    await dns.promises.resolve4("one.one.one.one")
  } catch {
    const servers = (process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1,8.8.4.4,1.0.0.1")
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)

    dns.setServers(servers)
  }
}

const mongoUri = process.env.MONGODB_URI

if (!mongoUri) {
  throw new Error("MONGODB_URI is not configured")
}

try {
  await configureDnsFallback()
  await mongoose.connect(mongoUri)

  const books = await mongoose.connection
    .collection("books")
    .find({}, { projection: { title: 1, slug: 1, persona: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray()

  if (books.length === 0) {
    console.log("No books found in the database.")
  }

  for (const book of books) {
    const voiceKey = resolveVoiceKey(book.persona)
    const voice = voiceOptions[voiceKey]
    const stored = book.persona === undefined ? "undefined" : JSON.stringify(book.persona)

    console.log(
      `${book.title} (/${book.slug})\n` +
        `  persona     : ${stored} [${describePersona(book.persona)}]\n` +
        `  session uses: ${voice.name} -> voiceId ${voice.id} (key "${voiceKey}")`,
    )
  }

  console.log(`\n${books.length} book(s) checked against MongoDB "${mongoose.connection.name}".`)
} finally {
  await mongoose.disconnect()
}
