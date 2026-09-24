import { TextSegment } from '@/types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const serializeData = <T>(data: T): T => JSON.parse(JSON.stringify(data))

export function generateSlug(text: string): string {
  return text
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const splitIntoSegments = (
  text: string,
  segmentSize: number = 500,
  overlapSize: number = 50,
): TextSegment[] => {
  if (segmentSize <= 0) {
    throw new Error('segmentSize must be greater than 0')
  }
  if (overlapSize < 0 || overlapSize >= segmentSize) {
    throw new Error('overlapSize must be >= 0 and < segmentSize')
  }

  const words = text.split(/\s+/).filter((word) => word.length > 0)
  const segments: TextSegment[] = []

  let segmentIndex = 0
  let startIndex = 0

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + segmentSize, words.length)
    const segmentWords = words.slice(startIndex, endIndex)
    const segmentText = segmentWords.join(' ')

    segments.push({
      text: segmentText,
      segmentIndex,
      wordCount: segmentWords.length,
    })

    segmentIndex++

    if (endIndex >= words.length) break
    startIndex = endIndex - overlapSize
  }

  return segments
}

/**
 * Reads a PDF in the browser: pulls the text out as searchable segments and
 * renders page 1 to a PNG data URL to use as the cover.
 */
export async function parsePDFFile(file: File) {
  try {
    const pdfjsLib = await import('pdfjs-dist')

    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
    }

    const arrayBuffer = await file.arrayBuffer()

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDocument = await loadingTask.promise

    const firstPage = await pdfDocument.getPage(1)
    const viewport = firstPage.getViewport({ scale: 2 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not get canvas context')
    }

    await firstPage.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    const coverDataURL = canvas.toDataURL('image/png')

    let fullText = ''

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .filter(
          (item: unknown) =>
            typeof item === 'object' && item !== null && 'str' in item,
        )
        .map((item: unknown) => (item as { str: string }).str)
        .join(' ')
      fullText += pageText + '\n'
    }

    const segments = splitIntoSegments(fullText)

    await pdfDocument.cleanup()

    return {
      content: segments,
      cover: coverDataURL,
    }
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error(
      `Failed to parse PDF file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
