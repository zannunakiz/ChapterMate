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
