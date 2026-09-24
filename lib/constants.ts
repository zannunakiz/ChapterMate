export type Book = {
  title: string
  author: string
  slug: string
  /** Real cover stored in the database (MongoDB books). */
  coverURL?: string
  /** Bundled picsum id, used by the sample/dummy books. */
  coverId?: number
}

/**
 * Cover image for a book: the database `coverURL` when present, otherwise the
 * bundled picsum id (sample books have no stored cover).
 */
export function bookCoverUrl(
  book: Pick<Book, "coverURL" | "coverId">,
  width: number,
  height: number,
): string {
  return (
    book.coverURL ??
    `https://picsum.photos/id/${book.coverId ?? 1}/${width}/${height}`
  )
}

export const sampleBooks: Book[] = [
  ["Pride and Prejudice", "Jane Austen", "pride-and-prejudice"],
  ["The Great Gatsby", "F. Scott Fitzgerald", "the-great-gatsby"],
  ["Jane Eyre", "Charlotte Brontë", "jane-eyre"],
  ["The Odyssey", "Homer", "the-odyssey"],
  ["Little Women", "Louisa May Alcott", "little-women"],
  ["Moby-Dick", "Herman Melville", "moby-dick"],
  ["Wuthering Heights", "Emily Brontë", "wuthering-heights"],
  ["The Picture of Dorian Gray", "Oscar Wilde", "the-picture-of-dorian-gray"],
  ["Frankenstein", "Mary Shelley", "frankenstein"],
  ["The Secret Garden", "Frances Hodgson Burnett", "the-secret-garden"],
].map(([title, author, slug], index) => ({
  title,
  author,
  slug,
  coverId: index + 1,
}))

export const myBooks: Book[] = [
  ["The Midnight Library", "Matt Haig", "the-midnight-library"],
  [
    "Tomorrow, and Tomorrow, and Tomorrow",
    "Gabrielle Zevin",
    "tomorrow-and-tomorrow-and-tomorrow",
  ],
  ["Klara and the Sun", "Kazuo Ishiguro", "klara-and-the-sun"],
  ["The Book Thief", "Markus Zusak", "the-book-thief"],
  ["A Man Called Ove", "Fredrik Backman", "a-man-called-ove"],
].map(([title, author, slug], index) => ({
  title,
  author,
  slug,
  coverId: index + 6,
}))

// ============================================
// VAPI / VOICE
// ============================================

// Pre-configured VAPI assistant ID (hardcoded for this app)
export const ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID!

// 11Labs Voice IDs - Optimized for conversational AI
// Voices selected for natural, engaging book conversations
export const voiceOptions = {
  // Male voices
  dave: {
    id: "CYw3kZ02Hs0563khs1Fj",
    name: "Dave",
    description: "Young male, British-Essex, casual & conversational",
  },
  daniel: {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    description: "Middle-aged male, British, authoritative but warm",
  },
  chris: {
    id: "iP95p4xoKVk53GoZ742B",
    name: "Chris",
    description: "Male, casual & easy-going",
  },
  // Female voices
  rachel: {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Young female, American, calm & clear",
  },
  sarah: {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Young female, American, soft & approachable",
  },
}

// Voice categories for the selector UI
export const voiceCategories = {
  male: ["dave", "daniel", "chris"],
  female: ["rachel", "sarah"],
}

/**
 * Canonical voice identifier persisted in `Book.persona`.
 *
 * Every writer of a book (the upload form, `SAMPLE_BOOKS`) must use one of
 * these keys. Readers may also pass a display name ("Dave") or a raw
 * ElevenLabs voice id, which `getVoiceKey()` in lib/utils.ts resolves.
 */
export type VoiceKey = keyof typeof voiceOptions

// Default voice
export const DEFAULT_VOICE = "rachel"

// ElevenLabs voice settings optimized for conversational AI
export const VOICE_SETTINGS = {
  stability: 0.45, // Lower for more emotional, dynamic delivery (0.30-0.50 is natural)
  similarityBoost: 0.75, // Enhances clarity without distortion
  style: 0, // Keep at 0 for conversational AI (higher = more latency, less stable)
  useSpeakerBoost: true, // Improves voice quality
  speed: 1.0, // Natural conversation speed
}

// VAPI configuration for natural conversation
// NOTE: These settings should be configured in the VAPI Dashboard for the assistant
// They are kept here for reference and documentation purposes
export const VAPI_DASHBOARD_CONFIG = {
  // Turn-taking settings
  startSpeakingPlan: {
    smartEndpointingEnabled: true,
    waitSeconds: 0.4,
  },
  stopSpeakingPlan: {
    numWords: 2,
    voiceSeconds: 0.2,
    backoffSeconds: 1.0,
  },
  // Timing settings
  silenceTimeoutSeconds: 30,
  responseDelaySeconds: 0.4,
  llmRequestDelaySeconds: 0.1,
  // Conversation features
  backgroundDenoisingEnabled: true,
  backchannelingEnabled: true,
  fillerInjectionEnabled: false,
}

export const SAMPLE_BOOKS: ReadonlyArray<{
  title: string
  author: string
  /** Canonical voice key, resolved by getVoice() → voiceOptions. */
  persona: VoiceKey
  clerkId: string
  pdfPath: string
  coverPath: string
}> = [
  {
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    persona: "rachel",
    clerkId: "sample-books",
    pdfPath: "lib/samples/Jane_Eyre.pdf",
    coverPath: "lib/samples/Jane_Eyre.png",
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    persona: "dave",
    clerkId: "sample-books",
    pdfPath: "lib/samples/The_Great_Gatsby.pdf",
    coverPath: "lib/samples/The_Great_Gatsby.png",
  },
  {
    title: "Dracula",
    author: "Bram Stoker",
    persona: "sarah",
    clerkId: "sample-books",
    pdfPath: "lib/samples/Dracula.pdf",
    coverPath: "lib/samples/Dracula.png",
  }
]
