import fs from 'node:fs/promises'
import mongoose from 'mongoose'
import Syllabus from '../models/Syllabus.js'
import { extractText } from '../services/textExtractor.js'
import { parseSyllabusText, parseManualOutline } from '../services/syllabusParser.js'

// Admin-only view. Syllabus is never returned by any student/evaluator API.
const publicView = (s) => ({
  id: s._id,
  title: s.title,
  subject: s.subject,
  description: s.description,
  fileName: s.fileName,
  fileType: s.fileType,
  units: s.units,
  unitCount: s.units.length,
  topicCount: s.units.reduce((n, u) => n + u.topics.length, 0),
  source: s.source,
  status: s.status,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
})

export async function list(_req, res) {
  const rows = await Syllabus.find().sort({ createdAt: -1 })
  res.json({ syllabi: rows.map(publicView) })
}

export async function getOne(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Syllabus not found.' })
  }
  const s = await Syllabus.findById(req.params.id)
  if (!s) return res.status(404).json({ error: 'Syllabus not found.' })
  res.json({ syllabus: { ...publicView(s), rawText: s.rawText } })
}

// Create manually (title + subject + units[] or free-text outline)
export async function create(req, res) {
  const { title, subject, description, units, outline } = req.body || {}
  if (!title || !subject) {
    return res.status(400).json({ error: 'Title and subject are required.' })
  }
  let unitList = Array.isArray(units) ? sanitizeUnits(units) : []
  if (unitList.length === 0 && outline) unitList = parseManualOutline(outline)

  const doc = await Syllabus.create({
    title: String(title).trim(),
    subject: String(subject).trim(),
    description: String(description || '').trim(),
    units: unitList,
    source: 'manual',
    status: 'saved',
    createdBy: req.user._id,
  })
  res.status(201).json({ syllabus: publicView(doc) })
}

// Upload a file -> auto extract + parse units/topics -> SAVE directly.
// No manual "add unit / add topic" step: the admin uploads and can immediately
// generate questions from the extracted content.
export async function uploadAndParse(req, res) {
  if (!req.file) return res.status(400).json({ error: 'A syllabus file is required.' })
  const { text, note } = await extractText(req.file.path, req.file.originalname)
  const units = parseSyllabusText(text)
  const title = req.body?.title?.trim() || req.file.originalname.replace(/\.[^.]+$/, '')
  const doc = await Syllabus.create({
    title,
    subject: req.body?.subject?.trim() || title,
    fileName: req.file.originalname,
    fileType: (req.file.originalname.split('.').pop() || '').toLowerCase(),
    filePath: req.file.path,
    rawText: text,
    units,
    source: 'upload',
    status: 'saved',
    createdBy: req.user._id,
  })
  res.status(201).json({
    syllabus: { ...publicView(doc), rawText: text.slice(0, 4000) },
    extractionNote: note || '',
  })
}

// Review/edit units & topics, subject, title, then save
export async function update(req, res) {
  const s = await Syllabus.findById(req.params.id)
  if (!s) return res.status(404).json({ error: 'Syllabus not found.' })
  const { title, subject, description, units, status } = req.body || {}
  if (title != null) s.title = String(title).trim()
  if (subject != null) s.subject = String(subject).trim()
  if (description != null) s.description = String(description).trim()
  if (Array.isArray(units)) s.units = sanitizeUnits(units)
  s.status = status === 'draft' ? 'draft' : 'saved'
  await s.save()
  res.json({ syllabus: publicView(s) })
}

export async function remove(req, res) {
  const s = await Syllabus.findByIdAndDelete(req.params.id)
  if (s?.filePath) fs.unlink(s.filePath).catch(() => {})
  res.json({ ok: true })
}

function sanitizeUnits(units) {
  return units
    .map((u) => ({
      name: String(u.name || '').trim(),
      topics: (Array.isArray(u.topics) ? u.topics : String(u.topics || '').split(','))
        .map((t) => String(t).trim())
        .filter(Boolean),
    }))
    .filter((u) => u.name && u.topics.length)
}
