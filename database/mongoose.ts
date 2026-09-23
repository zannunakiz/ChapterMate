import { ensureDnsResolvers } from '@/lib/dns-bootstrap'
import mongoose, { type ConnectOptions } from 'mongoose'

const options: ConnectOptions = {
  bufferCommands: false,
  connectTimeoutMS: 8_000,
  serverSelectionTimeoutMS: 6_000,
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Reuse the connection across hot reloads / route invocations.
const globalForMongoose = globalThis as unknown as {
  mongooseCache?: MongooseCache
}

const cached: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
}

globalForMongoose.mongooseCache = cached

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI)
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }

  await ensureDnsResolvers()

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, options)
  }

  try {
    cached.conn = await cached.promise
  } catch (error) {
    cached.promise = null
    throw error
  }

  return cached.conn
}

export default connectToDatabase
