import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })
}

async function registerWithRole(req, res, role) {
  const { name, email, password, confirmPassword } = req.body || {}

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' })
  }
  if (!EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }
  if (confirmPassword != null && confirmPassword !== password) {
    return res.status(400).json({ error: 'Passwords do not match.' })
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() })
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  const passwordHash = await bcrypt.hash(String(password), 10)
  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    role,
  })

  // Do NOT auto-login: return the created user only.
  return res.status(201).json({ user: user.toSafeJSON() })
}

export const registerStudent = (req, res) => registerWithRole(req, res, 'student')
export const registerEvaluator = (req, res) => registerWithRole(req, res, 'evaluator')

export async function login(req, res) {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }
  // Trim defensively (registration already stores trimmed emails) so a stray
  // leading/trailing space from a browser/autofill can never turn into a false
  // "account not found".
  const normalizedEmail = String(email).toLowerCase().trim()

  const user = await User.findOne({ email: normalizedEmail })
  if (!user) {
    console.warn(`[auth] login failed — no account for "${normalizedEmail}"`)
    return res.status(401).json({ error: 'Invalid email or password.' })
  }
  const match = await bcrypt.compare(String(password), user.passwordHash)
  if (!match) {
    console.warn(`[auth] login failed — wrong password for "${normalizedEmail}" (role: ${user.role})`)
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  console.log(`[auth] login success — "${normalizedEmail}" (role: ${user.role})`)
  return res.json({ token: signToken(user), user: user.toSafeJSON() })
}

export async function me(req, res) {
  return res.json({ user: req.user.toSafeJSON() })
}
