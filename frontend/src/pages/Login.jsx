import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import PasswordInput from '../components/ui/PasswordInput'

const CONFIG = {
  student: {
    heading: 'Student Login',
    description: 'Sign in to access your assessments and project evaluation',
    button: 'Login as Student',
    dashboard: '/student/dashboard',
    registerTo: '/register/student',
  },
  admin: {
    heading: 'Admin Login',
    description: 'Sign in to manage assessments and student evaluations',
    button: 'Login as Admin',
    dashboard: '/admin/dashboard',
    registerTo: null,
  },
  evaluator: {
    heading: 'Evaluator Login',
    description: 'Sign in to evaluate student projects',
    button: 'Login as Evaluator',
    dashboard: '/evaluator/dashboard',
    registerTo: '/register/evaluator',
  },
}

export default function Login({ role = 'student' }) {
  const cfg = CONFIG[role] ?? CONFIG.student
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [notice] = useState(location.state?.notice ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const u = await login(email.trim(), password)
      if (u.role !== role) {
        setError(`This account is registered as ${u.role}. Use the ${u.role} login page.`)
        setSubmitting(false)
        return
      }
      navigate(cfg.dashboard, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <img className="sidebar__mark" src="/evalai-logo-mark.png" alt="EvalAI logo" />
          EvalAI
        </div>
        <p className="auth__tagline">Assess. Evaluate. Improve.</p>

        {notice && <div className="auth__notice">{notice}</div>}

        <form onSubmit={handleSubmit}>
          <h2 className="auth__heading">{cfg.heading}</h2>
          <p className="auth__desc">{cfg.description}</p>

          {error && <div className="auth__error">{error}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Signing in…' : cfg.button}
          </Button>
        </form>

        {cfg.registerTo && (
          <p className="auth__alt">
            Don&apos;t have an account? <Link to={cfg.registerTo}>Register</Link>
          </p>
        )}
      </div>
    </div>
  )
}
