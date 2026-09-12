// Runs automatically before `npm run dev` / `npm start` (via the `predev` /
// `prestart` npm lifecycle hooks in backend/package.json). Makes sure PORT is
// free before the server tries to bind it, so a stale backend process left
// over from a previous run can never cause "Port 5000 is already in use" /
// a failed `npm run dev` again.
//
// Safety: this will ONLY stop a process that is (a) node.exe and (b) was
// launched running this project's server.js. It will never touch an
// unrelated application that happens to be using the port — it just warns
// and leaves it alone, so `server.js`'s own EADDRINUSE message still explains
// what to do by hand in that (very unlikely) case.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import dotenv from 'dotenv'

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(backendDir, '.env') })
const PORT = Number(process.env.PORT) || 5000

function freePortWindows(port) {
  // One self-contained PowerShell call: find whatever is LISTENing on the
  // port, and only Stop-Process it if it is a node.exe whose command line
  // is literally running this backend's server.js.
  const script = [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$conns = Get-NetTCPConnection -LocalPort ${port} -State Listen`,
    `if (-not $conns) { exit 0 }`,
    `$targets = $conns.OwningProcess | Sort-Object -Unique`,
    `foreach ($ownerPid in $targets) {`,
    `  if ($ownerPid -eq ${process.pid}) { continue }`,
    `  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid"`,
    `  if ($proc -and $proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'server\\.js') {`,
    `    Stop-Process -Id $ownerPid -Force`,
    `    Write-Output "KILLED:$($ownerPid)"`,
    `  } else {`,
    `    $name = if ($proc) { $proc.Name } else { 'unknown' }`,
    `    Write-Output "SKIPPED:$($ownerPid):$($name)"`,
    `  }`,
    `}`,
  ].join('\n')

  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  })
}

function freePortPosix(port) {
  let pids = ''
  try {
    pids = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' })
  } catch {
    return '' // lsof unavailable or nothing listening
  }
  const lines = []
  for (const pid of pids.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    if (Number(pid) === process.pid) continue
    let cmd = ''
    try {
      cmd = execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' })
    } catch {
      /* ignore */
    }
    if (/node/.test(cmd) && /server\.js/.test(cmd)) {
      try {
        execFileSync('kill', ['-9', pid])
        lines.push(`KILLED:${pid}`)
      } catch (err) {
        lines.push(`ERROR:${pid}:${err.message}`)
      }
    } else {
      lines.push(`SKIPPED:${pid}:${cmd.trim() || 'unknown'}`)
    }
  }
  return lines.join('\n')
}

async function main() {
  let out = ''
  try {
    out = process.platform === 'win32' ? freePortWindows(PORT) : freePortPosix(PORT)
  } catch (err) {
    console.warn(`[preflight] could not check port ${PORT}: ${err.message} — proceeding anyway.`)
    return
  }

  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    console.log(`[preflight] port ${PORT} is free.`)
    return
  }

  let killed = false
  for (const line of lines) {
    if (line.startsWith('KILLED:')) {
      console.log(`[preflight] stopped a stale backend process (PID ${line.split(':')[1]}) holding port ${PORT}.`)
      killed = true
    } else if (line.startsWith('SKIPPED:')) {
      const [, pid, name] = line.split(':')
      console.warn(
        `[preflight] port ${PORT} is held by PID ${pid} ("${name}"), which is not this backend — leaving it ` +
          `alone. Free it yourself or change PORT in backend/.env if this keeps happening.`,
      )
    }
  }
  if (killed) {
    // give the OS a moment to fully release the socket before we rebind it
    await new Promise((r) => setTimeout(r, 400))
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // Never block startup because the preflight itself had a problem.
    console.warn(`[preflight] port check failed unexpectedly: ${err.message} — proceeding anyway.`)
    process.exit(0)
  })
