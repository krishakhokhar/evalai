import Project from '../models/Project.js'
import { extractText } from '../services/textExtractor.js'
import { parseProjectBrief } from '../services/projectBriefParser.js'

const view = (p) => ({
  id: p._id,
  title: p.title,
  description: p.description,
  requirements: p.requirements,
  instructions: p.instructions,
  techStack: p.techStack,
  deadline: p.deadline,
  maxMarks: p.maxMarks,
  fileName: p.referenceFileName || '',
  syllabusId: p.syllabusId,
  evaluationCriteria: p.evaluationCriteria,
  status: p.status,
  publishedAt: p.publishedAt,
  createdAt: p.createdAt,
})

function normalize(body) {
  const toList = (v) =>
    Array.isArray(v)
      ? v
      : String(v || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
  return {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    requirements: toList(body.requirements),
    instructions: String(body.instructions || '').trim(),
    techStack: String(body.techStack || '').trim(),
    deadline: body.deadline ? new Date(body.deadline) : null,
    maxMarks: Number(body.maxMarks) > 0 ? Number(body.maxMarks) : 100,
    syllabusId: body.syllabusId || null,
    evaluationCriteria: toList(body.evaluationCriteria),
  }
}

// ---------- Admin ----------
export async function list(_req, res) {
  const rows = await Project.find().sort({ createdAt: -1 })
  res.json({ projects: rows.map(view) })
}

export async function create(req, res) {
  const data = normalize(req.body || {})
  if (!data.title) return res.status(400).json({ error: 'Project title is required.' })
  const status = ['draft', 'published', 'closed'].includes(req.body?.status) ? req.body.status : 'draft'
  const doc = await Project.create({
    ...data,
    status,
    publishedAt: status === 'published' ? new Date() : null,
    createdBy: req.user._id,
  })
  res.status(201).json({ project: view(doc) })
}

// Upload a brief document (PDF/DOC/DOCX/TXT/XLS/XLSX/CSV) -> extract + parse into
// a DRAFT project the admin then reviews/edits and publishes. Never auto-published.
export async function uploadAndParse(req, res) {
  if (!req.file) return res.status(400).json({ error: 'A project brief file is required.' })
  const { text, note } = await extractText(req.file.path, req.file.originalname)
  const brief = parseProjectBrief(text)
  const doc = await Project.create({
    title: brief.title || req.file.originalname.replace(/\.[^.]+$/, ''),
    description: brief.description,
    requirements: brief.requirements,
    instructions: brief.instructions,
    techStack: brief.techStack,
    deadline: brief.deadline,
    maxMarks: brief.maxMarks,
    referenceFileName: req.file.originalname,
    referenceFilePath: req.file.path,
    status: 'draft',
    createdBy: req.user._id,
  })
  res.status(201).json({ project: view(doc), extractionNote: note || '' })
}

export async function update(req, res) {
  const p = await Project.findById(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  const data = normalize({ ...view(p), ...req.body })
  Object.assign(p, data)
  if (['draft', 'published', 'closed'].includes(req.body?.status)) {
    p.status = req.body.status
    p.publishedAt = req.body.status === 'published' ? p.publishedAt || new Date() : null
  }
  await p.save()
  res.json({ project: view(p) })
}

export async function setPublished(req, res) {
  const p = await Project.findById(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  const publish = req.body?.published !== false
  p.status = publish ? 'published' : 'draft'
  p.publishedAt = publish ? new Date() : null
  await p.save()
  res.json({ project: view(p) })
}

export async function remove(req, res) {
  await Project.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
}

// ---------- Student / Evaluator ----------
export async function listPublished(_req, res) {
  const rows = await Project.find({ status: 'published' }).sort({ publishedAt: -1 })
  res.json({ projects: rows.map(view) })
}

export async function getOne(req, res) {
  const p = await Project.findById(req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found.' })
  // students/evaluators can only fetch a published project by id
  if (req.user.role !== 'admin' && p.status !== 'published') {
    return res.status(404).json({ error: 'Project not found.' })
  }
  res.json({ project: view(p) })
}
