import nextEnv from "@next/env"
import { put } from "@vercel/blob"
import { readFile } from "node:fs/promises"
import dns from "node:dns"
import mongoose from "mongoose"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const { loadEnvConfig } = nextEnv
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))

loadEnvConfig(projectRoot)

const { SAMPLE_BOOKS, SAMPLE_BOOKS_CLERK_ID, voiceOptions } = await import("../lib/constants.ts")

function generateSlug(text) {
  return text
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function splitIntoSegments(text, segmentSize = 500, overlapSize = 50) {
  const words = text.split(/\s+/).filter(Boolean)
  const segments = []

  for (let startIndex = 0; startIndex < words.length; ) {
    const endIndex = Math.min(startIndex + segmentSize, words.length)
    const segmentWords = words.slice(startIndex, endIndex)

    segments.push({
      content: segmentWords.join(" "),
      segmentIndex: segments.length,
      wordCount: segmentWords.length,
    })

    if (endIndex >= words.length) break
    startIndex = endIndex - overlapSize
  }

  return segments
}

async function extractPdfSegments(pdfBuffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const pdf = await getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
  }).promise
  let text = ""

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    text += `${content.items.map((item) => item.str ?? "").join(" ")}\n`
  }

  const segments = splitIntoSegments(text)
  if (segments.length === 0) {
    throw new Error("Sample PDF did not contain searchable text")
  }

  return segments
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
const blobToken = process.env.BLOB_READ_WRITE_TOKEN

if (!mongoUri) throw new Error("MONGODB_URI is not configured")
if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured")

try {
  await configureDnsFallback()
  await mongoose.connect(mongoUri)

  const books = mongoose.connection.collection("books")
  const bookSegments = mongoose.connection.collection("booksegments")
  const sampleClerkId = SAMPLE_BOOKS_CLERK_ID
  const existingBooks = await books
    .find({ clerkId: sampleClerkId }, { projection: { _id: 1 } })
    .toArray()

  if (existingBooks.length > 0) {
    await bookSegments.deleteMany({
      bookId: { $in: existingBooks.map((book) => book._id) },
    })
    await books.deleteMany({ clerkId: sampleClerkId })
  }

  for (const sample of SAMPLE_BOOKS) {
    if (sample.clerkId !== sampleClerkId) {
      throw new Error(`Unexpected sample clerkId for ${sample.title}`)
    }
    if (!voiceOptions[sample.persona]) {
      throw new Error(
        `Unknown persona "${sample.persona}" for ${sample.title}; expected one of ${Object.keys(voiceOptions).join(", ")}`,
      )
    }

    const [pdfBuffer, coverBuffer] = await Promise.all([
      readFile(resolve(projectRoot, sample.pdfPath)),
      readFile(resolve(projectRoot, sample.coverPath)),
    ])
    const segments = await extractPdfSegments(pdfBuffer)
    const slug = generateSlug(sample.title)
    const [pdfBlob, coverBlob] = await Promise.all([
      put(`sample-books/${slug}.pdf`, pdfBuffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
        token: blobToken,
      }),
      put(`sample-books/${slug}-cover.png`, coverBuffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/png",
        token: blobToken,
      }),
    ])
    const now = new Date()
    const { insertedId: bookId } = await books.insertOne({
      clerkId: sample.clerkId,
      title: sample.title,
      slug,
      author: sample.author,
      persona: sample.persona,
      fileURL: pdfBlob.url,
      fileBlobKey: pdfBlob.pathname,
      coverURL: coverBlob.url,
      coverBlobKey: coverBlob.pathname,
      fileSize: pdfBuffer.byteLength,
      totalSegments: segments.length,
      createdAt: now,
      updatedAt: now,
    })

    await bookSegments.insertMany(
      segments.map((segment) => ({
        clerkId: sample.clerkId,
        bookId,
        ...segment,
        createdAt: now,
        updatedAt: now,
      })),
    )

    console.log(`Seeded ${sample.title}: ${segments.length} segments`)
  }

  console.log(`Seeded ${SAMPLE_BOOKS.length} sample books for ${sampleClerkId}`)
} finally {
  await mongoose.disconnect()
}
