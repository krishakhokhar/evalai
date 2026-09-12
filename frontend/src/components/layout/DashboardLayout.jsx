import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ role }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="layout">
      <Sidebar
        role={role}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen && (
        <div
          className="sidebar__backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main">
        <Topbar role={role} onMenu={() => setMenuOpen((v) => !v)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
