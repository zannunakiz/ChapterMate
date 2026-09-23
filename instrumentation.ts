/**
 * Runs once when a Next.js server instance starts.
 * Fixes the Node DNS resolver before any MongoDB Atlas `mongodb+srv://`
 * connection is attempted in this process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDnsResolvers } = await import('./lib/dns-bootstrap')
    await ensureDnsResolvers()
  }
}
