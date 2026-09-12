import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      console.warn(`[auth] 401 ${req.method} ${req.originalUrl} — no Authorization: Bearer <token> header`)
      return res.status(401).json({ error: 'Authentication required.' })
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub)
    if (!user) {
      console.warn(`[auth] 401 ${req.method} ${req.originalUrl} — token subject ${payload.sub} has no matching user`)
      return res.status(401).json({ error: 'Account no longer exists.' })
    }

    req.user = user
    next()
  } catch (err) {
    console.warn(`[auth] 401 ${req.method} ${req.originalUrl} — invalid/expired token (${err.message})`)
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.warn(
        `[auth] 403 ${req.method} ${req.originalUrl} — user ${req.user?.email ?? '(none)'} has role ` +
          `"${req.user?.role ?? 'none'}", route requires one of: ${roles.join(', ')}`,
      )
      return res.status(403).json({ error: 'You do not have access to this resource.' })
    }
    next()
  }
}
