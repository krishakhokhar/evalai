// Dependency-free inline-SVG charts, themed via CSS variables.
// (No chart library is installed in this project — these are reused everywhere.)

const EMPTY = 'No data available yet'
const PALETTE = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--info)']

// Single-value gauge (kept for existing "score out of X" spots).
export function DonutStat({ value = 0, max = 100, label, sublabel, size = 120 }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const r = size / 2 - 10
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="chart-donut" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="47%" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)">
          {Math.round(pct)}%
        </text>
        {sublabel && (
          <text x="50%" y="63%" textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {sublabel}
          </text>
        )}
      </svg>
      {label && <div className="chart-donut__label">{label}</div>}
    </div>
  )
}

// Proper pie / donut for proportions (pass/fail, completion, status split).
// segments: [{ label, value, color? }]
export function Donut({ segments = [], size = 140, thickness = 22, centerLabel }) {
  const clean = segments.filter((s) => Number(s.value) > 0)
  const total = clean.reduce((s, x) => s + Number(x.value), 0)
  if (!clean.length || total === 0) {
    return <p className="muted">{EMPTY}</p>
  }
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  // pre-compute each segment's arc length and its cumulative start offset
  const arcs = clean.reduce((acc, s) => {
    const len = (Number(s.value) / total) * circ
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0
    acc.push({ len, start })
    return acc
  }, [])
  return (
    <div className="chart-pie">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="proportion chart">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {clean.map((s, i) => (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color || PALETTE[i % PALETTE.length]}
            strokeWidth={thickness}
            strokeDasharray={`${arcs[i].len} ${circ - arcs[i].len}`}
            strokeDashoffset={-arcs[i].start}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        {centerLabel != null && (
          <text x="50%" y="52%" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="chart-pie__legend">
        {clean.map((s, i) => (
          <li key={s.label}>
            <i className="chart-pie__dot" style={{ background: s.color || PALETTE[i % PALETTE.length] }} />
            {s.label} — {s.value} ({Math.round((s.value / total) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

// Horizontal bar chart for comparison (marks / criteria / subjects).
// data: [{ label, value }], value 0..100 unless `max` given
export function BarChart({ data = [], max, unit = '%' }) {
  if (!data.length) return <p className="muted">{EMPTY}</p>
  const top = max ?? Math.max(1, ...data.map((d) => Number(d.value) || 0))
  return (
    <div className="chart-bars">
      {data.map((d, i) => (
        <div className="chart-bars__row" key={`${d.label}-${i}`}>
          <span className="chart-bars__label" title={d.label}>{d.label}</span>
          <span className="chart-bars__track">
            <span className="chart-bars__fill" style={{ width: `${Math.min(100, ((Number(d.value) || 0) / top) * 100)}%` }} />
          </span>
          <span className="chart-bars__val">{d.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

// Two-segment stacked bar (correct vs incorrect, quick pass/fail).
export function SplitBar({ a = 0, b = 0, aLabel = 'A', bLabel = 'B' }) {
  const total = a + b
  if (total === 0) return <p className="muted">{EMPTY}</p>
  return (
    <div>
      <div className="chart-split">
        <span className="chart-split__a" style={{ width: `${(a / total) * 100}%` }} />
        <span className="chart-split__b" style={{ width: `${(b / total) * 100}%` }} />
      </div>
      <div className="chart-split__legend">
        <span><i className="dot dot--a" /> {aLabel}: {a}</span>
        <span><i className="dot dot--b" /> {bLabel}: {b}</span>
      </div>
    </div>
  )
}

// Column chart for ordered/time-based series (attempt history, score trend).
// data: [{ label, value }]
export function ColumnChart({ data = [], unit = '%' }) {
  if (!data.length) return <p className="muted">{EMPTY}</p>
  const top = Math.max(1, ...data.map((d) => Number(d.value) || 0))
  return (
    <div className="chart-cols">
      {data.map((d, i) => (
        <div className="chart-cols__col" key={i} title={`${d.label}: ${d.value}${unit}`}>
          <span className="chart-cols__bar" style={{ height: `${((Number(d.value) || 0) / top) * 100}%` }} />
          <span className="chart-cols__label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
