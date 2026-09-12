export default function EmptyState({ title, message, action }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {message && <p className="empty__msg">{message}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}
