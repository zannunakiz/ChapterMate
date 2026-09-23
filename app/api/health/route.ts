import { runHealthChecks } from '@/lib/health'

// Health must always reflect the live state of the services.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const { report, cached } = await runHealthChecks()

  return Response.json(
    { ...report, cached },
    {
      status: report.success ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
