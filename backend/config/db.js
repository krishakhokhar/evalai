import mongoose from 'mongoose'

// ---------------------------------------------------------------------------
// Robust MongoDB connection for local development.
//
//  * The API server calls startDatabase() (non-blocking, retries forever).
//  * One-off scripts call connectDB() (single attempt, throws on failure).
//  * `dbConnected` resolves the first time a connection is established.
//  * Never prints the URI password. Never exits the process.
// ---------------------------------------------------------------------------

const SELECTION_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS) || 10000

let resolveConnected
export const dbConnected = new Promise((res) => {
  resolveConnected = res
})

let listenersBound = false
let retryTimer = null
let retryDelay = 2000

export function dbState() {
  return mongoose.connection.readyState // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
}
export function isDbConnected() {
  return mongoose.connection.readyState === 1
}
export function dbStatusLabel() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState()] || 'unknown'
}

function maskUri(uri = '') {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:/@]+:)[^@]+@/i, '$1****@')
}

function connectOptions() {
  return {
    serverSelectionTimeoutMS: SELECTION_TIMEOUT_MS,
    socketTimeoutMS: 45000,
    family: 4, // prefer IPv4 — avoids flaky dual-stack DNS on some networks
  }
}

function diagnose(err, uri = '') {
  const m = err?.message || String(err)
  if (uri.startsWith('mongodb+srv://') && /querySrv|ENOTFOUND|ESERVFAIL|EAI_AGAIN|getaddrinfo/i.test(m)) {
    console.error(
      '[db] The Atlas SRV hostname could not be resolved — this is a DNS/network issue, not the app.\n' +
        '     Fix on your machine: (1) confirm internet access,\n' +
        '     (2) in MongoDB Atlas → Network Access, add your current IP (or 0.0.0.0/0 for local dev),\n' +
        '     (3) set your OS DNS to 8.8.8.8 / 1.1.1.1, or\n' +
        '     (4) use the NON-SRV connection string from Atlas ("mongodb://host1,host2,host3/db?replicaSet=...&tls=true").',
    )
  } else if (/ETIMEDOUT|Server selection timed out|connection timed out/i.test(m)) {
    console.error(
      '[db] Timed out reaching MongoDB. Check your connection and that the Atlas IP allowlist includes this machine.',
    )
  } else if (/authentication failed|bad auth/i.test(m)) {
    console.error(
      '[db] Authentication failed. Check the username/password in MONGO_URI (special characters must be percent-encoded).',
    )
  }
}

function bindListeners() {
  if (listenersBound) return
  listenersBound = true
  const c = mongoose.connection

  c.on('connected', () => {
    retryDelay = 2000
    console.log(`[db] MongoDB connected successfully (database: "${c.name}")`)
    resolveConnected?.()
  })
  c.on('reconnected', () => console.log('[db] MongoDB reconnected'))
  c.on('error', (err) => console.error(`[db] MongoDB connection error: ${err.message}`))
  c.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected — retrying in the background (API stays up)')
    scheduleRetry()
  })
}

function scheduleRetry() {
  if (retryTimer) return
  if (dbState() === 1 || dbState() === 2) return // already connected / connecting
  const delay = retryDelay
  retryDelay = Math.min(Math.round(retryDelay * 1.5), 30000)
  retryTimer = setTimeout(async () => {
    retryTimer = null
    if (dbState() === 1 || dbState() === 2) return
    console.log('[db] MongoDB connecting... (retry)')
    try {
      await mongoose.connect(process.env.MONGO_URI, connectOptions())
    } catch (err) {
      console.error(`[db] MongoDB connection error: ${err.message}`)
      diagnose(err, process.env.MONGO_URI || '')
      scheduleRetry()
    }
  }, delay)
  // The reconnect timer must not, by itself, keep the process alive.
  retryTimer.unref?.()
}

/**
 * Non-blocking connect for the API server. Never throws, never exits.
 * Keeps retrying in the background until MongoDB is reachable.
 */
export function startDatabase() {
  const uri = process.env.MONGO_URI
  mongoose.set('strictQuery', true)
  bindListeners()

  if (!uri) {
    console.error(
      '[db] MONGO_URI is not set in backend/.env — the API will run but every DB endpoint will return 503 until it is fixed.',
    )
    return
  }

  console.log(`[db] MongoDB connecting... (${maskUri(uri)})`)
  mongoose.connect(uri, connectOptions()).catch((err) => {
    console.error(`[db] MongoDB connection error: ${err.message}`)
    diagnose(err, uri)
    scheduleRetry()
  })
}

/**
 * Single-attempt connect for standalone scripts (reset-admin, e2e fallback).
 * Throws a clean error on failure.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is not set. Create backend/.env (see backend/.env.example).')
  }
  mongoose.set('strictQuery', true)
  bindListeners()
  if (dbState() === 1) return
  console.log(`[db] MongoDB connecting... (${maskUri(uri)})`)
  try {
    await mongoose.connect(uri, connectOptions())
  } catch (err) {
    diagnose(err, uri)
    throw new Error(`Could not connect to MongoDB: ${err.message}`)
  }
}
