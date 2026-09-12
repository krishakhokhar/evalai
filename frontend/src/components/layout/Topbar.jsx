import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { NAV } from '../../config/nav'
import Button from '../ui/Button'

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Topbar({ role, onMenu }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const current = NAV[role]?.items.find((i) => pathname.startsWith(i.to))
  const fallback = /\/evaluate\//.test(pathname) ? 'Evaluate Project' : 'Dashboard'
  const crumb = `${NAV[role]?.label ?? ''} / ${current?.label ?? fallback}`

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="icon-btn" onClick={onMenu} aria-label="Toggle menu">
          ☰
        </button>
        <span className="topbar__crumb">{crumb}</span>
      </div>
      <div className="topbar__right">
        <div className="topbar__user">
          <span className="topbar__user-name">{user?.name}</span>
          <span className="topbar__user-role">{user?.role}</span>
        </div>
        <span className="avatar">{initials(user?.name)}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  )
}
