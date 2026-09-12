import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NAV } from '../config/nav'

const LOGIN_PATH = { student: '/login', admin: '/admin', evaluator: '/evaluator' }

export default function RequireRole({ role }) {
  const { role: current, ready } = useAuth()

  if (!ready) {
    return (
      <div className="auth">
        <p className="muted">Checking your session…</p>
      </div>
    )
  }
  if (!current) return <Navigate to={LOGIN_PATH[role] ?? '/login'} replace />
  if (current !== role) {
    return <Navigate to={`${NAV[current].base}/dashboard`} replace />
  }
  return <Outlet />
}
