import nextEnv from "@next/env"
import mongoose from "mongoose"
import dns from "node:dns"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

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

  const databaseName = mongoose.connection.name
  await mongoose.connection.dropDatabase()

  console.log(`Cleared MongoDB database: ${databaseName}`)
} finally {
  await mongoose.disconnect()
}
