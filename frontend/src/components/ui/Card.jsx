export default function Card({
  title,
  subtitle,
  actions,
  flush = false,
  className = '',
  style,
  children,
}) {
  const hasHeader = title || actions
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {hasHeader && (
        <div className="card__header">
          <div>
            {title && <div className="card__title">{title}</div>}
            {subtitle && <div className="card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card__body ${flush ? 'card__body--flush' : ''}`.trim()}>
        {children}
      </div>
    </div>
  )
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <div className="stat">
        <span className="stat__label">{label}</span>
        <span className="stat__value">{value}</span>
        {hint && <span className="stat__hint">{hint}</span>}
      </div>
    </div>
  )
}
