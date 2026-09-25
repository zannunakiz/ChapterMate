import dns from 'node:dns'

const PROBE_HOST = 'one.one.one.one'
const DEFAULT_PUBLIC_SERVERS = ['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']

let configured = false

function getFallbackServers(): string[] {
  const fromEnv = process.env.DNS_SERVERS

  if (fromEnv) {
    const parsed = fromEnv
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean)

    if (parsed.length) return parsed
  }

  return DEFAULT_PUBLIC_SERVERS
}

function resolverWorks(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false

    const done = (value: boolean) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }

    const timer = setTimeout(() => done(false), timeoutMs)

    dns.promises.resolve4(PROBE_HOST).then(
      () => {
        clearTimeout(timer)
        done(true)
      },
      () => {
        clearTimeout(timer)
        done(false)
      },
    )
  })
}

/**
 * MongoDB Atlas `mongodb+srv://` URIs require the driver to resolve DNS SRV
 * records (e.g. `_mongodb._tcp.<cluster>.mongodb.net`) before it can connect.
 *
 * Some networks (VPNs, offices, certain ISPs) leave the Node.js resolver
 * (c-ares) unable to resolve anything, which surfaces as:
 *
 *   querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 *
 * Browsers keep working because they use the OS DNS stack instead.
 *
 * This bootstrap probes the system resolver and only overrides it when it is
 * demonstrably failing. Healthy setups are left untouched. The fallback
 * servers can be overridden with the `DNS_SERVERS` env var (comma separated).
 */
export async function ensureDnsResolvers(): Promise<boolean> {
  if (configured) return true

  const systemDnsWorks = await resolverWorks()

  if (systemDnsWorks) {
    configured = true
    return true
  }

  const servers = getFallbackServers()

  try {
    dns.setServers(servers)
  } catch {
    return false
  }

  configured = true

  const fixed = await resolverWorks()

  return fixed
}
