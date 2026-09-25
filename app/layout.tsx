import { Toaster } from '@/components/ui/sonner'
import { PostHogPageView } from '@/components/posthog-page-view'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import {
  Instrument_Sans,
  Instrument_Serif,
  JetBrains_Mono,
} from 'next/font/google'
import React from 'react'
import './globals.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'ChapterMate',
  description:
    'Chat with AI voice agents about your favorite books. Upload your own PDFs or explore curated classics.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ClerkProvider
          dynamic
          afterSignOutUrl="/"
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
        >
          {children}
        </ClerkProvider>
        {/* Suspense is required because PostHogPageView reads useSearchParams. */}
        <React.Suspense fallback={null}>
          <PostHogPageView />
        </React.Suspense>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
