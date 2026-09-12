import fs from 'node:fs/promises'
import Question from '../models/Question.js'
import Syllabus from '../models/Syllabus.js'
import { extractText } from '../services/textExtractor.js'
import { generateQuestions, NoSyllabusContentError } from '../services/questionGenerator.js'

const view = (q) => ({
  id: q._id,
  question: q.question,
  options: q.options,
  correctAnswer: q.correctAnswer,
  subject: q.subject,
  unit: q.unit,
  topic: q.topic,
  difficulty: q.difficulty,
  marks: q.marks,
  explanation: q.explanation,
  sourceSyllabusId: q.sourceSyllabusId,
  status: q.status,
  origin: q.origin,
  createdAt: q.createdAt,
})

function normalizeIncoming(q, extra = {}) {
  const opts = q.options || {}
  const options = {
    A: String(opts.A ?? q.optionA ?? '').trim(),
    B: String(opts.B ?? q.optionB ?? '').trim(),
    C: String(opts.C ?? q.optionC ?? '').trim(),
    D: String(opts.D ?? q.optionD ?? '').trim(),
  }
  return {
    question: String(q.question || '').trim(),
    options,
    correctAnswer: ['A', 'B', 'C', 'D'].includes(q.correctAnswer) ? q.correctAnswer : 'A',
    subject: String(q.subject || extra.subject || '').trim(),
    unit: String(q.unit || '').trim(),
    topic: String(q.topic || '').trim(),
    difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
    marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    explanation: String(q.explanation || '').trim(),
    sourceSyllabusId: q.sourceSyllabusId || extra.sourceSyllabusId || undefined,
    status: ['draft', 'approved', 'published'].includes(q.status) ? q.status : 'draft',
    origin: q.origin || extra.origin || 'manual',
  }
}

const isValid = (q) =>
  q.question && q.options.A && q.options.B && q.options.C && q.options.D

export async function list(req, res) {
  const filter = {}
  const { status, subject, syllabusId, unit, topic } = req.query
  if (status) filter.status = status
  if (subject) filter.subject = subject
  if (syllabusId) filter.sourceSyllabusId = syllabusId
  if (unit) filter.unit = unit
  if (topic) filter.topic = topic
  const rows = await Question.find(filter).sort({ createdAt: -1 }).limit(500)
  res.json({ questions: rows.map(view) })
}

export async function createMany(req, res) {
  const items = Array.isArray(req.body?.questions)
    ? req.body.questions
    : req.body?.question
      ? [req.body]
      : []
  const docs = items.map((q) => normalizeIncoming(q)).filter(isValid)
  if (docs.length === 0) return res.status(400).json({ error: 'No valid questions supplied.' })
  const created = await Question.insertMany(docs.map((d) => ({ ...d, createdBy: req.user._id })))
  res.status(201).json({ created: created.length, questions: created.map(view) })
}

export async function update(req, res) {
  const q = await Question.findById(req.params.id)
  if (!q) return res.status(404).json({ error: 'Question not found.' })
  const patch = normalizeIncoming({ ...view(q), ...req.body })
  if (!isValid(patch)) return res.status(400).json({ error: 'Question and all four options are required.' })
  Object.assign(q, patch)
  await q.save()
  res.json({ question: view(q) })
}

export async function setStatus(req, res) {
  const { status } = req.body || {}
  if (!['draft', 'approved', 'published'].includes(status)) {
    return res.status(400).json({ error: 'status must be draft, approved or published.' })
  }
  const q = await Question.findByIdAndUpdate(req.params.id, { status }, { returnDocument: "after" })
  if (!q) return res.status(404).json({ error: 'Question not found.' })
  res.json({ question: view(q) })
}

export async function remove(req, res) {
  await Question.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
}

// POST /api/questions/generate  -> returns DRAFT questions (not persisted)
export async function generate(req, res) {
  const { syllabusId, unit, topic, count, difficulty, marks, persist } = req.body || {}
  if (!syllabusId) return res.status(400).json({ error: 'syllabusId is required.' })
  const syllabus = await Syllabus.findById(syllabusId)
  if (!syllabus) return res.status(404).json({ error: 'Syllabus not found.' })

  let generated
  try {
    generated = await generateQuestions({
      syllabus,
      unit,
      topic,
      count: count || 5,
      difficulty: difficulty || 'Mixed',
      marks: marks || 1,
    })
  } catch (err) {
    if (err instanceof NoSyllabusContentError) {
      return res.status(400).json({ error: err.message })
    }
    throw err
  }
  const withSource = generated.map((q) => ({ ...q, sourceSyllabusId: syllabus._id }))

  if (persist) {
    const created = await Question.insertMany(
      withSource.map((q) => ({ ...q, createdBy: req.user._id })),
    )
    return res.status(201).json({ questions: created.map(view), persisted: true })
  }
  res.json({ questions: withSource, persisted: false })
}

// POST /api/questions/import  (multipart: file) — TXT / XLSX / DOCX
// TXT format per question block:
//   Q: text
//   A) opt  B) opt  C) opt  D) opt   (one per line)
//   Answer: B
export async function importFile(req, res) {
  if (!req.file) return res.status(400).json({ error: 'A file is required.' })
  const { text } = await extractText(req.file.path, req.file.originalname)
  fs.unlink(req.file.path).catch(() => {})
  const parsed = parseQuestionText(text, {
    subject: req.body?.subject || '',
    sourceSyllabusId: req.body?.syllabusId || undefined,
  })
  if (parsed.length === 0) {
    return res.status(400).json({ error: 'Could not parse any questions from the file.' })
  }
  const created = await Question.insertMany(
    parsed.map((q) => ({ ...q, origin: 'import', createdBy: req.user._id })),
  )
  res.status(201).json({ created: created.length, questions: created.map(view) })
}

function parseQuestionText(text, extra) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  const out = []
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const qLine = lines.find((l) => /^q[:.)]/i.test(l) || /\?$/.test(l))
    const answerLine = lines.find((l) => /^answer\s*[:.]/i.test(l))
    const optLines = lines.filter((l) => /^[A-D][).:]\s*/i.test(l))
    if (!qLine || optLines.length < 4) continue
    const options = {}
    optLines.slice(0, 4).forEach((l) => {
      const k = l[0].toUpperCase()
      options[k] = l.replace(/^[A-D][).:]\s*/i, '').trim()
    })
    const correct = (answerLine?.match(/[A-D]/i)?.[0] || 'A').toUpperCase()
    out.push(
      normalizeIncoming(
        {
          question: qLine.replace(/^q[:.)]\s*/i, '').trim(),
          options,
          correctAnswer: correct,
        },
        extra,
      ),
    )
  }
  return out.filter(isValid)
}
