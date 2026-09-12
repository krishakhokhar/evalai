import { useState } from 'react'

function Node({ node, depth }) {
  const [open, setOpen] = useState(depth < 2)
  const pad = { paddingLeft: depth * 16 + 10 }

  if (node.type === 'file') {
    return (
      <div className="tree__row" style={pad}>
        <span className="tree__icon">📄</span>
        <span>{node.name}</span>
        {node.sensitive && (
          <span className="tree__warn">⚠ Sensitive value detected</span>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="tree__row tree__row--dir"
        style={pad}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tree__icon">{open ? '▾' : '▸'}</span>
        <span>{node.name}</span>
      </button>
      {open &&
        node.children.map((child, i) => (
          <Node key={`${child.name}-${i}`} node={child} depth={depth + 1} />
        ))}
    </>
  )
}

export default function FileTree({ tree }) {
  if (!tree) return null
  return (
    <div className="tree">
      <Node node={tree} depth={0} />
    </div>
  )
}
