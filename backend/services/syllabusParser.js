// Parse extracted syllabus text into units -> topics.
// Heuristic and deterministic — grounded ONLY in the actual extracted text.
// Never uses a filename, title, or database/upload ID as syllabus content.
//
// Supports, in the same document if needed:
//   - explicit headers: "UNIT 1", "Module 2", "Chapter 3", "Section 4", "Week 5"
//   - bare numbered unit rows common in real syllabi: "1 Introduction: ...",
//     "2. Process Management: ..." (a small integer, no decimal point)
//   - numbered sub-topics: "1.1 What is Data Science", "2.3. Data Types"
//   - dense comma/semicolon-separated topic lists within a unit's paragraph
//   - plain bullet lists with no unit headers at all (falls back to one unit)
// and filters out common non-syllabus noise: page headers/footers repeated
// per page, "Page X of Y" / "-- X of Y --" page-break markers, teaching-scheme
// table rows that are pure numbers, and trailing sections (reference books,
// list of experiments, course outcomes) that use their own unrelated numbering
// and would otherwise be mistaken for dozens of extra "units".

const KEYWORD_UNIT_RE = /^\s*(unit|module|chapter|section|week)\s*[-:.]?\s*([0-9ivxlcdm]+)?\s*[-:.)]?\s*(.*)$/i
// A bare numbered unit row, e.g. "1 Introduction: Computer system overview, ..."
// Requires the text right after the number to start with a capital letter, so
// it never matches a pure-numbers table row (those fail the `[A-Z]` check).
const NUMBERED_UNIT_RE = /^\s*(\d{1,2})\b[.):-]?\s+([A-Z].{2,120})$/
// A decimal sub-topic heading, e.g. "1.1 What is Data Science", "2.3. Data Types"
const NUMBERED_TOPIC_RE = /^\s*(\d{1,2}\.\d{1,2})\.?\s*[-:.]?\s*(.{2,160})$/
const BULLET_RE = /^\s*(?:[-*•·>]|\d+[.)]|[a-z][.)])\s+/i

// Lines that are pure noise, never a unit/topic on their own.
const NOISE_LINE_RE = /^[\d\s%.-]+$/
const PAGE_BREAK_RE = /^-{0,2}\s*\d+\s+of\s+\d+\s*-{0,2}$|^page\s+\d+\s+of\s+\d+$/i
const ADMIN_META_RE =
  /^(subject\s*(code|name)\s*[:.-]|semester\s*[:.-]?\s|type of course\s*[:.-]|prerequisite\s*[:.-]|w\.e\.f\.?\b|teaching\s*(and|&)\s*examination scheme|credits?\s*[:.-])/i
// A standalone all-caps banner line (institution name, running header/footer).
// Deliberately excludes commas so it never eats a legitimate all-caps topic
// list like "HTML, CSS, HTTP" — institution/footer banners are plain phrases,
// comma-separated acronym lists are real syllabus content.
const ALL_CAPS_BANNER_RE = /^[A-Z][A-Z\s.&'-]{9,70}$/
// Sections that follow the real unit-by-unit syllabus and use their own,
// unrelated numbering (reference books, lab experiment lists, outcomes) —
// once one of these is seen, stop looking for further units entirely.
const STOP_SECTION_RE =
  /^(reference\s*books?|text\s*books?|list of experiments|course outcomes?|suggested specification|list of open source)/i

function healLineWraps(rawText) {
  const lines = []
  for (const raw of String(rawText || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const prev = lines[lines.length - 1]
    // A hyphenated word broken across a PDF line-wrap, e.g. "real-\ntime" -> "real-time"
    if (prev && /[a-z]-$/.test(prev) && /^[a-z]/.test(line)) {
      lines[lines.length - 1] = prev.slice(0, -1) + line
    } else {
      lines.push(line)
    }
  }
  return lines
}

function splitTopics(paragraph) {
  return paragraph
    .split(/[,;]|\.\s+(?=[A-Z])/)
    .map((t) => t.replace(BULLET_RE, '').replace(/[.;]+$/, '').trim())
    .filter((t) => t && t.length >= 2 && !/^\d+$/.test(t))
    .map((t) => (t.length > 160 ? `${t.slice(0, 157)}...` : t))
}

export function parseSyllabusText(rawText) {
  const lines = healLineWraps(rawText)

  const units = []
  const preamble = []
  let current = null
  let buffer = []
  let sawBoundary = false

  const flush = () => {
    if (!current || buffer.length === 0) {
      buffer = []
      return
    }
    const paragraph = buffer.join(' ')
    buffer = []
    splitTopics(paragraph).forEach((t) => {
      if (!current.topics.includes(t)) current.topics.push(t)
    })
  }

  const startUnit = (label) => {
    flush()
    current = { name: label, topics: [] }
    units.push(current)
  }

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line) || NOISE_LINE_RE.test(line) || ADMIN_META_RE.test(line)) continue
    if (STOP_SECTION_RE.test(line)) break
    if (ALL_CAPS_BANNER_RE.test(line) && !/\d/.test(line)) continue

    const kw = line.match(KEYWORD_UNIT_RE)
    if (kw && (kw[2] || kw[3])) {
      sawBoundary = true
      const label = (kw[3] || '').replace(/[-:.]+$/, '').trim()
      startUnit(label ? `Unit ${units.length + 1}: ${label}` : `Unit ${units.length + 1}`)
      continue
    }

    const num = line.match(NUMBERED_UNIT_RE)
    if (num) {
      sawBoundary = true
      const full = num[2].trim()
      const colonIdx = full.indexOf(':')
      const label = (colonIdx > -1 ? full.slice(0, colonIdx) : full.slice(0, 60)).trim()
      startUnit(`Unit ${units.length + 1}: ${label}`)
      const rest = colonIdx > -1 ? full.slice(colonIdx + 1).trim() : ''
      if (rest) buffer.push(rest)
      continue
    }

    const sub = line.match(NUMBERED_TOPIC_RE)
    if (sub) {
      if (!current) startUnit('Unit 1')
      buffer.push(sub[2].trim())
      continue
    }

    if (!current) {
      // Still in front-matter before the first real unit boundary — buffer it
      // provisionally; it's discarded once a real unit is found, and used as a
      // last-resort single unit only if the document never has one at all.
      if (!sawBoundary) preamble.push(line)
      continue
    }
    buffer.push(line)
  }
  flush()

  if (units.length === 0) {
    const text = preamble.join(' ').trim()
    if (text.length > 20) {
      current = { name: 'Unit 1', topics: [] }
      units.push(current)
      splitTopics(text).forEach((t) => {
        if (!current.topics.includes(t)) current.topics.push(t)
      })
    }
  }

  return units
    .map((u) => ({ name: u.name, topics: [...new Set(u.topics)].slice(0, 25) }))
    .filter((u) => u.topics.length)
    .slice(0, 20)
}

// Manual entry helper: free text -> units. "Unit:" lines start units; other
// lines (comma-separated allowed) are topics of the current unit.
export function parseManualOutline(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim())
  const units = []
  let current = null
  for (const line of lines) {
    if (!line) continue
    const unitMatch = line.match(/^(unit|module)\s*[0-9]*\s*[:.-]?\s*(.*)$/i)
    if (unitMatch) {
      current = { name: line.replace(/\s+$/, ''), topics: [] }
      units.push(current)
      continue
    }
    if (!current) {
      current = { name: `Unit ${units.length + 1}`, topics: [] }
      units.push(current)
    }
    line.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (!current.topics.includes(t)) current.topics.push(t)
    })
  }
  return units.filter((u) => u.topics.length)
}
