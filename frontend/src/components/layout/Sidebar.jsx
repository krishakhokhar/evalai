import { NavLink } from 'react-router-dom'
import { NAV } from '../../config/nav'

export default function Sidebar({ role, open, onNavigate }) {
  const section = NAV[role]
  if (!section) return null

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`.trim()}>
      <div className="sidebar__brand">
        <img className="sidebar__mark" src="/evalai-logo-mark.png" alt="EvalAI logo" />
        EvalAI
      </div>
      <nav className="sidebar__section">
        <div className="sidebar__label">{section.label}</div>
        {section.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'is-active' : ''}`.trim()
            }
          >
            <span className="nav-item__dot" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
