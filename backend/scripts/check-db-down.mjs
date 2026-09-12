// Verifies the API stays up (no process.exit / restart loop) when MongoDB is
// unreachable, and that DB endpoints return a clean 503 instead of crashing.
process.env.MONGO_URI = 'mongodb://127.0.0.1:59999/evalai_down' // nothing listening here
process.env.JWT_SECRET = 'test'
process.env.PORT = '5096'
process.env.DB_TIMEOUT_MS = '1500'

let exited = false
const realExit = process.exit.bind(process)
process.exit = (code) => {
  exited = true
  console.error('!! process.exit was called with', code)
  realExit(code)
}

const server = await import('../server.js')

const BASE = 'http://localhost:5096/api'
const get = async (p) => {
  const r = await fetch(BASE + p)
  let d = null
  try {
    d = JSON.parse(await r.text())
  } catch {
    /* ignore */
  }
  return { status: r.status, d }
}

await new Promise((r) => setTimeout(r, 900)) // let it bind + fail the first connect

const health = await get('/health')
const dbRoute = await get('/dashboard/stats')

let ok = true
const check = (cond, msg) => {
  console.log((cond ? 'ok  - ' : 'FAIL - ') + msg)
  if (!cond) ok = false
}

check(!exited, 'process did NOT exit while MongoDB is unreachable')
check(health.status === 200, `GET /api/health -> 200 (got ${health.status})`)
check(health.d?.api === 'running', 'health: api = "running"')
check(health.d?.success === false && health.d?.database !== 'connected', `health: success=false, database="${health.d?.database}"`)
check(dbRoute.status === 503, `GET /api/dashboard/stats -> 503 (got ${dbRoute.status})`)
check(typeof dbRoute.d?.error === 'string', 'DB route returns { error: string } — no crash')

console.log('\n' + (ok ? 'DB-DOWN CHECK PASSED' : 'DB-DOWN CHECK FAILED'))
process.exit = realExit
try {
  server.mongoose?.connection?.removeAllListeners?.()
  await new Promise((res) => server.httpServer?.close(res))
  await server.mongoose?.disconnect?.()
} catch {
  /* ignore */
}
realExit(ok ? 0 : 1)

