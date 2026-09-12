export default function ProgressBar({ value = 0, label, showValue = true }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="progress">
      {(label || showValue) && (
        <div className="progress__meta">
          <span>{label}</span>
          {showValue && <span>{pct}%</span>}
        </div>
      )}
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
