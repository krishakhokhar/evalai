// Parse extracted document text into a project brief the admin then reviews/edits.
// Heuristic and deterministic — nothing is auto-published.

const HEADING = {
  requirements: /^(requirements?|deliverables?|features?|scope|tasks?)\s*[:.]?\s*$/i,
  instructions: /^(instructions?|guidelines?|notes?|submission)\s*[:.]?\s*$/i,
  description: /^(description|overview|about|summary)\s*[:.]?\s*$/i,
}
const BULLET_RE = /^\s*(?:[-*•·▪]|\d+[.)]|[a-z][.)])\s+/i
const TITLE_RE = /^(title|project|project title|assignment)\s*[:.-]\s*(.+)$/i
const TECH_RE = /^(technology|tech(?: ?stack)?|stack|tools?|languages?)\s*[:.-]\s*(.+)$/i
const MARKS_RE = /^(max(?:imum)? marks?|total marks?|marks?|points?)\s*[:.-]\s*(\d+)/i
const DEADLINE_RE = /^(deadline|due(?: date)?|submit by)\s*[:.-]\s*(.+)$/i

export function parseProjectBrief(rawText) {
  const lines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const brief = {
    title: '',
    description: '',
    requirements: [],
    instructions: '',
    techStack: '',
    maxMarks: 100,
    deadline: null,
  }
  let section = 'description'
  const descParts = []
  const instrParts = []

  lines.forEach((line, i) => {
    let m
    if ((m = line.match(TITLE_RE))) { brief.title = m[2].trim(); return }
    if ((m = line.match(TECH_RE))) { brief.techStack = m[2].trim(); return }
    if ((m = line.match(MARKS_RE))) { brief.maxMarks = Number(m[2]) || 100; return }
    if ((m = line.match(DEADLINE_RE))) {
      const d = new Date(m[2].trim())
      if (!Number.isNaN(+d)) brief.deadline = d
      return
    }
    if (HEADING.requirements.test(line)) { section = 'requirements'; return }
    if (HEADING.instructions.test(line)) { section = 'instructions'; return }
    if (HEADING.description.test(line)) { section = 'description'; return }

    if (!brief.title && i === 0 && line.length <= 120) { brief.title = line; return }

    if (section === 'requirements') {
      const t = line.replace(BULLET_RE, '').trim()
      if (t && t.length <= 300) brief.requirements.push(t)
    } else if (section === 'instructions') {
      instrParts.push(line.replace(BULLET_RE, '').trim())
    } else {
      // bullet lines anywhere still look like requirements
      if (BULLET_RE.test(line)) brief.requirements.push(line.replace(BULLET_RE, '').trim())
      else descParts.push(line)
    }
  })

  brief.description = descParts.join(' ').slice(0, 4000)
  brief.instructions = instrParts.join('\n').slice(0, 4000)
  brief.requirements = [...new Set(brief.requirements.filter(Boolean))].slice(0, 40)
  if (!brief.title) brief.title = 'Project task'
  return brief
}
