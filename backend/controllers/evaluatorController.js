import fs from 'node:fs'
import ProjectSubmission from '../models/ProjectSubmission.js'
import Evaluation from '../models/Evaluation.js'
import Project from '../models/Project.js'
import { getActiveCriteria } from '../models/Criteria.js'
import { evaluateProject } from '../services/mockAI.js'

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const toList = (v) =>
  Array.isArray(v)
    ? v.map((s) => String(s).trim()).filter(Boolean)
    : String(v || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

function rowFor(sub) {
  return {
    id: sub._id,
    student: sub.studentId?.name || 'Student',
    studentEmail: sub.studentId?.email || '',
    project: sub.projectName,
    projectTask: sub.projectTitle || null,
    technology: sub.technology,
    submittedAt: sub.submittedAt,
    status: sub.submissionStatus,
  }
}

export async function dashboard(req, res) {
  const pending = await ProjectSubmission.countDocuments({
    submissionStatus: { $in: ['submitted', 'under_review'] },
  })
  const mine = await Evaluation.find({ evaluatorId: req.user._id }).sort({ updatedAt: 1 })
  const avg = mine.length
    ? Math.round(mine.reduce((s, e) => s + e.totalScore, 0) / mine.length)
    : 0

  // Real per-criterion averages across this evaluator's own evaluations.
  const critAgg = {}
  mine.forEach((e) => {
    ;(e.rubricScores || []).forEach((c) => {
      critAgg[c.key] = critAgg[c.key] || { sum: 0, n: 0, max: c.max || 0 }
      critAgg[c.key].sum += c.score
      critAgg[c.key].n += 1
      critAgg[c.key].max = Math.max(critAgg[c.key].max, c.max || 0)
    })
  })
  const criteriaAverages = Object.entries(critAgg).map(([key, v]) => ({
    key,
    avg: Math.round(v.sum / v.n),
    max: v.max,
  }))

  res.json({
    pending,
    completed: mine.length,
    averageScore: avg,
    criteriaAverages,
    scoreHistory: mine.map((e, i) => ({
      label: `#${i + 1}`,
      value: Math.round((e.totalScore / (e.maxMarks || 100)) * 100),
    })),
  })
}

export async function pending(_req, res) {
  const list = await ProjectSubmission.find({
    submissionStatus: { $in: ['submitted', 'under_review'] },
  })
    .populate('studentId', 'name email')
    .sort({ submittedAt: 1 })
  res.json({ projects: list.map(rowFor) })
}

export async function completed(req, res) {
  const evals = await Evaluation.find({ evaluatorId: req.user._id })
    .populate({ path: 'projectSubmissionId', select: 'projectName technology submittedAt' })
    .populate('studentId', 'name')
    .sort({ updatedAt: -1 })
  res.json({
    projects: evals.map((e) => ({
      id: e.projectSubmissionId?._id,
      student: e.studentId?.name || 'Student',
      project: e.projectSubmissionId?.projectName || '—',
      technology: e.projectSubmissionId?.technology || '—',
      score: e.totalScore,
      date: e.updatedAt,
    })),
  })
}

export async function projectById(req, res) {
  const sub = await ProjectSubmission.findById(req.params.id).populate('studentId', 'name email')
  if (!sub) return res.status(404).json({ error: 'Project submission not found.' })

  const criteria = await getActiveCriteria()
  const ai = evaluateProject(sub.projectAnalysis || {}, criteria.items)
  const existing = await Evaluation.findOne({ projectSubmissionId: sub._id })
  const task = sub.projectId ? await Project.findById(sub.projectId) : null

  res.json({
    project: {
      id: sub._id,
      studentName: sub.studentId?.name || 'Student',
      studentEmail: sub.studentId?.email || '',
      projectName: sub.projectName,
      projectTask: sub.projectTitle || null,
      technology: sub.technology,
      description: sub.description,
      submittedAt: sub.submittedAt,
      status: sub.submissionStatus,
      fileName: sub.originalFileName,
      fileSize: sub.fileSize,
      analysis: sub.projectAnalysis || null,
      brief: task
        ? {
            requirements: task.requirements,
            instructions: task.instructions,
            deadline: task.deadline,
            maxMarks: task.maxMarks,
            evaluationCriteria: task.evaluationCriteria,
          }
        : null,
    },
    criteria: criteria.items,
    aiSuggested: ai,
    existingEvaluation: existing
      ? {
          rubricScores: existing.rubricScores,
          totalScore: existing.totalScore,
          evaluatorComments: existing.evaluatorComments,
          finalFeedback: existing.finalFeedback,
          strengths: existing.strengths,
          weaknesses: existing.weaknesses,
          recommendations: existing.recommendations,
        }
      : null,
  })
}

export async function downloadZip(req, res) {
  const sub = await ProjectSubmission.findById(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Project submission not found.' })
  if (!sub.filePath || !fs.existsSync(sub.filePath)) {
    return res.status(404).json({ error: 'The uploaded file is no longer available.' })
  }
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${(sub.originalFileName || 'submission.zip').replace(/[^\w.-]/g, '_')}"`,
  )
  fs.createReadStream(sub.filePath).pipe(res)
}

async function saveEvaluation(req, res, submissionId) {
  const sub = await ProjectSubmission.findById(submissionId).populate('studentId', 'name')
  if (!sub) return res.status(404).json({ error: 'Project submission not found.' })

  const criteria = await getActiveCriteria()
  const ai = evaluateProject(sub.projectAnalysis || {}, criteria.items)

  const incoming = Array.isArray(req.body?.rubricScores) ? req.body.rubricScores : []
  const rubricScores = ai.criteria.map((c) => {
    const provided = incoming.find((x) => x.key === c.key)
    const score = provided ? clamp(Math.round(Number(provided.score) || 0), 0, c.max) : c.score
    return {
      key: c.key,
      max: c.max,
      score,
      evidence: c.evidence,
      reason: c.reason,
      recommendation: c.recommendation,
    }
  })
  const maxMarks = rubricScores.reduce((s, c) => s + c.max, 0) || 100
  const totalScore = rubricScores.reduce((s, c) => s + c.score, 0)
  if (totalScore > maxMarks) {
    return res.status(400).json({ error: `Total score cannot exceed ${maxMarks}.` })
  }

  // Evaluator-authored feedback wins; fall back to the AI suggestion.
  const strengths = req.body?.strengths != null ? toList(req.body.strengths) : ai.strengths
  const weaknesses = req.body?.weaknesses != null ? toList(req.body.weaknesses) : ai.weaknesses
  const recommendations =
    req.body?.recommendations != null ? toList(req.body.recommendations) : ai.recommendations
  const comments = String(req.body?.evaluatorComments || '').trim()
  const finalFeedback = String(req.body?.finalFeedback || comments).trim()

  const doc = await Evaluation.findOneAndUpdate(
    { projectSubmissionId: sub._id },
    {
      projectSubmissionId: sub._id,
      studentId: sub.studentId._id,
      evaluatorId: req.user._id,
      rubricScores,
      totalScore,
      maxMarks,
      strengths,
      weaknesses,
      recommendations,
      skillProfile: ai.skillProfile,
      evaluatorComments: comments,
      finalFeedback,
      aiSuggested: { total: ai.total, max: ai.max, criteria: ai.criteria },
      status: 'completed',
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )

  sub.submissionStatus = 'evaluated'
  sub.evaluatorId = req.user._id
  sub.score = totalScore
  sub.maxMarks = maxMarks
  sub.feedback = finalFeedback
  await sub.save()

  res.json({ evaluation: { id: doc._id, totalScore: doc.totalScore, maxMarks } })
}

export const submitEvaluation = (req, res) =>
  saveEvaluation(req, res, req.body?.projectSubmissionId)
export const updateEvaluation = (req, res) => saveEvaluation(req, res, req.params.id)
