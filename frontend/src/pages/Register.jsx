import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import PasswordInput from '../components/ui/PasswordInput'

const CONFIG = {
  student: {
    heading: 'Create Student Account',
    button: 'Create Student Account',
    notice: 'Student account created. Please sign in.',
    loginPath: '/login',
  },
  evaluator: {
    heading: 'Create Evaluator Account',
    button: 'Create Evaluator Account',
    notice: 'Evaluator account created. Please sign in.',
    loginPath: '/evaluator',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register({ role }) {
  const cfg = CONFIG[role] ?? CONFIG.student
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Full name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters.'
    if (!form.confirm) next.confirm = 'Please confirm your password.'
    else if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await register({
        role,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirm,
      })
      navigate(cfg.loginPath, { state: { notice: cfg.notice } })
    } catch (err) {
      setFormError(err.message || 'Registration failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <span className="sidebar__mark">E</span>
          EvalAI
        </div>
        <p className="auth__tagline">Assess. Evaluate. Improve.</p>

        <form onSubmit={handleSubmit} noValidate>
          <h2 className="auth__heading">{cfg.heading}</h2>
          <p className="auth__desc">Register to get access to the EvalAI workspace.</p>

          {formError && <div className="auth__error">{formError}</div>}

          <div className="field">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              className="input"
              placeholder="Your name"
              autoComplete="name"
              value={form.name}
              onChange={update('name')}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm Password</label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={update('confirm')}
            />
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>

          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Creating account…' : cfg.button}
          </Button>
        </form>

        <p className="auth__alt">
          Already have an account? <Link to={cfg.loginPath}>Login</Link>
        </p>
      </div>
    </div>
  )
}
