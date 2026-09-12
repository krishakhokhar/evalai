import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

import {
  startDatabase,
  dbConnected,
  isDbConnected,
  dbState,
  dbStatusLabel,
} from './config/db.js'
import User from './models/User.js'
import { getActiveCriteria } from './models/Criteria.js'

import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import studentRoutes from './routes/student.js'
import evaluatorRoutes from './routes/evaluator.js'
import syllabiRoutes from './routes/syllabi.js'
import questionRoutes from './routes/questions.js'
import assessmentRoutes from './routes/assessments.js'
import projectRoutes from './routes/projects.js'
import resultRoutes from './routes/results.js'
import dashboardRoutes from './routes/dashboard.js'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') })

if (!process.env.JWT_SECRET) {
  console.error(
    '[fatal] JWT_SECRET is not set in backend/.env — every login and protected request will fail. ' +
      'Set JWT_SECRET to a long random string and restart the backend.',
  )
}
if (!process.env.MONGO_URI) {
  console.error(
    '[fatal] MONGO_URI is not set in backend/.env — no data will load and every API call will 503. ' +
      'Copy backend/.env.example to backend/.env and fill it in.',
  )
}

export const app = express()
const PORT = process.env.PORT || 5000

// Flips to true only after the one-time startup seed (admin account reconciled,
// default criteria ensured) finishes. Requests let through before that point can
// hit a database that is connected but not yet in its expected state — e.g. the
// admin account not created/updated yet — which surfaces as a false 401 on
// login right after a restart. See the `ready`/`whenReady()` wiring below.
let seedReady = false

// Allowed browser origins:
//  - every value in CLIENT_ORIGIN (comma-separated) from backend/.env
//  - any http(s)://localhost:<port> / 127.0.0.1:<port>  (Vite hops dev ports: 5173, 5174, 5175, …)
const ENV_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

function isAllowedOrigin(origin) {
  if (!origin) return true // curl / same-origin / server-to-server
  if (ENV_ORIGINS.includes(origin)) return true
  return LOCALHOST_RE.test(origin)
}

app.use(
  cors({
    origin: (origin, cb) =>
      isAllowedOrigin(origin)
        ? cb(null, true) // reflects this origin into Access-Control-Allow-Origin
        : cb(new Error(`Origin ${origin} not allowed by CORS`)),
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))

// --- Health: never touches the DB, never throws, always HTTP 200 ---
app.get('/api/health', (_req, res) => {
  const connected = isDbConnected()
  res.status(200).json({
    success: connected,
    api: 'running',
    database: connected ? 'connected' : dbStatusLabel(),
  })
})

// --- DB gate: only let API requests through once MongoDB is connected AND the
// one-time startup seed (admin reconciliation + default criteria) has finished.
// While either is pending, fail fast with a clean 503 instead of letting
// queries hang, crash, or — worse — let a login slip through against a database
// that doesn't have the reconciled admin account yet (a false 401). /api/health
// is registered above this line, so it is never gated.
app.use('/api', (_req, res, next) => {
  if (dbState() === 1 && seedReady) return next()
  res.status(503).json({
    success: false,
    error:
      dbState() === 1
        ? 'Server is finishing startup — please retry in a moment.'
        : 'Database is temporarily unavailable. The API is up and reconnecting — please retry shortly.',
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/evaluator', evaluatorRoutes)
app.use('/api/syllabi', syllabiRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/assessments', assessmentRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }))
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Server error.' })
})

// The bootstrap admin is defined entirely by backend/.env. On first DB connect we
// reconcile the DB account to match ADMIN_EMAIL / ADMIN_PASSWORD: create it if
// missing, fix the role if it drifted, and reset the password if it no longer
// matches ADMIN_PASSWORD. So ".env is the source of truth — restart to apply".
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — admin account not managed.')
    return
  }
  const lc = email.toLowerCase().trim()
  const existing = await User.findOne({ email: lc })

  if (!existing) {
    await User.create({
      name: 'Administrator',
      email: lc,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
    })
    console.log(`[seed] admin account created for ${lc}`)
    return
  }

  const changed = []
  if (existing.role !== 'admin') {
    existing.role = 'admin'
    changed.push('role→admin')
  }
  const passwordMatches = await bcrypt.compare(password, existing.passwordHash)
  if (!passwordMatches) {
    existing.passwordHash = await bcrypt.hash(password, 10)
    changed.push('password reset to ADMIN_PASSWORD')
  }
  if (!existing.name || !existing.name.trim()) {
    existing.name = 'Administrator'
    changed.push('name')
  }

  if (changed.length) {
    await existing.save()
    console.warn(`[seed] admin account ${lc} reconciled with backend/.env — ${changed.join(', ')}.`)
  } else {
    console.log(`[seed] admin account ${lc} already matches backend/.env.`)
  }
}

// Resolves once MongoDB is connected AND one-time seeds have run.
export const ready = dbConnected.then(async () => {
  try {
    await ensureAdmin()
    await getActiveCriteria()
  } catch (err) {
    console.error(`[seed] deferred startup seed failed: ${err.message}`)
  }
  seedReady = true
  return true
})
export function whenReady() {
  return ready
}

export let httpServer = null

export function start() {
  // 1) API listens immediately — independent of MongoDB.
  httpServer = app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`)
  })
  httpServer.on('error', (err) => {
    // A truly fatal startup error — not a DB issue, so exiting is correct.
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[fatal] Port ${PORT} is already in use — another backend instance is still running.\n` +
          `        Stop it (close its terminal / Ctrl+C, or: Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force),\n` +
          `        or set a different PORT in backend/.env. Then start ONE of "npm run dev" or "npm run server".`,
      )
    } else {
      console.error(`[fatal] ${err.message}`)
    }
    process.exit(1)
  })
  // 2) Connect to MongoDB in the background, retrying forever. Never exits.
  startDatabase()
  return httpServer
}

start()

// Do not let an unhandled promise rejection anywhere in the app silently kill
// the API — log it clearly and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error(`[warn] unhandled rejection: ${reason?.message || reason}`)
})
// A truly uncaught synchronous exception outside the request lifecycle leaves
// the process in an unknown state, so exit — but say exactly why first. This is
// what "the server randomly stopped working" looks like without this handler:
// Node prints a bare stack trace with no context and the terminal just sits there.
process.on('uncaughtException', (err) => {
  console.error(`[fatal] uncaught exception — the server is stopping: ${err?.stack || err}`)
  process.exit(1)
})

export { mongoose }
export default app
