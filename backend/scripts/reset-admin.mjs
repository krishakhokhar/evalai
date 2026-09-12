// Reconcile the admin account in MongoDB with backend/.env WITHOUT starting the
// HTTP server: create it if missing, fix its role, reset its password to
// ADMIN_PASSWORD. Prints the database it touched so you can match it in Compass.
//
// Run from the repo root:  npm run reset-admin
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const { connectDB } = await import('../config/db.js')
const User = (await import('../models/User.js')).default

const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
const password = process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error('ADMIN_EMAIL / ADMIN_PASSWORD are not set in backend/.env')
  process.exit(1)
}

await connectDB()
console.log(`connected to database: "${mongoose.connection.name}"`)

let user = await User.findOne({ email })
if (!user) {
  user = await User.create({
    name: 'Administrator',
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'admin',
  })
  console.log(`created admin ${email}`)
} else {
  const changes = []
  if (user.role !== 'admin') {
    user.role = 'admin'
    changes.push('role→admin')
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.passwordHash = await bcrypt.hash(password, 10)
    changes.push('password reset')
  }
  if (changes.length) {
    await user.save()
    console.log(`reconciled admin ${email}: ${changes.join(', ')}`)
  } else {
    console.log(`admin ${email} already matches backend/.env — nothing to do`)
  }
}

console.log(`\nLog in at http://localhost:5173/admin with:\n  email:    ${email}\n  password: ${password}`)
await mongoose.disconnect()
process.exit(0)
