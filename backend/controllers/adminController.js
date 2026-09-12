import User from '../models/User.js'
import ProjectSubmission from '../models/ProjectSubmission.js'
import Evaluation from '../models/Evaluation.js'
import Assessment from '../models/Assessment.js'
import AssessmentAttempt from '../models/AssessmentAttempt.js'
import { getActiveCriteria } from '../models/Criteria.js'

export async function dashboard(_req, res) {
  const [students, evaluators, submissions, evaluations, publishedAssessments, attempts] =
    await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'evaluator' }),
      ProjectSubmission.countDocuments(),
      Evaluation.find(),
      Assessment.countDocuments({ status: 'published' }),
      AssessmentAttempt.find({ status: 'submitted' }),
    ])
  const pending = await ProjectSubmission.countDocuments({
    submissionStatus: { $in: ['submitted', 'under_review'] },
  })
  const projScores = evaluations.map((e) => e.totalScore)
  const mcqScores = attempts.map((a) => a.percentage)
  const allScores = [...projScores, ...mcqScores]
  const averageScore = allScores.length
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 0

  const recent = await ProjectSubmission.find()
    .populate('studentId', 'name')
    .sort({ submittedAt: -1 })
    .limit(6)

  // ---- analytics (real, from the same records) ----
  const passAssessments = await Assessment.find({}, 'passingMarks')
  const passById = new Map(passAssessments.map((a) => [String(a._id), a.passingMarks || 0]))
  let mcqPass = 0
  let mcqFail = 0
  const subjectAgg = {}
  const attemptsBySubject = await AssessmentAttempt.find({ status: 'submitted' }).populate({
    path: 'assessmentId',
    select: 'subject passingMarks',
  })
  attemptsBySubject.forEach((t) => {
    const passMark = passById.get(String(t.assessmentId?._id)) ?? 0
    if (t.score >= passMark) mcqPass += 1
    else mcqFail += 1
    const subj = t.assessmentId?.subject || 'General'
    subjectAgg[subj] = subjectAgg[subj] || { total: 0, sum: 0 }
    subjectAgg[subj].total += 1
    subjectAgg[subj].sum += t.percentage
  })
  const totalSubs = await ProjectSubmission.countDocuments()

  res.json({
    stats: {
      totalStudents: students,
      totalEvaluators: evaluators,
      publishedAssessments,
      submittedProjects: submissions,
      pendingEvaluations: pending,
      completedEvaluations: evaluations.length,
      averageScore,
    },
    analytics: {
      passFail: { pass: mcqPass, fail: mcqFail },
      evaluationProgress: { completed: evaluations.length, pending },
      subjectPerformance: Object.entries(subjectAgg).map(([subject, v]) => ({
        subject,
        avgPercent: Math.round(v.sum / v.total),
        attempts: v.total,
      })),
      projectScores: evaluations
        .map((e) => Math.round((e.totalScore / (e.maxMarks || 100)) * 100))
        .sort((a, b) => a - b),
      submissionStatus: {
        submitted: await ProjectSubmission.countDocuments({ submissionStatus: 'submitted' }),
        underReview: await ProjectSubmission.countDocuments({ submissionStatus: 'under_review' }),
        evaluated: await ProjectSubmission.countDocuments({ submissionStatus: 'evaluated' }),
        total: totalSubs,
      },
    },
    recentSubmissions: recent.map((s) => ({
      id: s._id,
      student: s.studentId?.name || 'Student',
      project: s.projectName,
      technology: s.technology,
      submittedAt: s.submittedAt,
      status: s.submissionStatus,
    })),
  })
}

export async function students(_req, res) {
  const list = await User.find({ role: 'student' }).sort({ createdAt: 1 })
  const rows = await Promise.all(
    list.map(async (u) => {
      const sub = await ProjectSubmission.findOne({ studentId: u._id }).sort({ submittedAt: -1 })
      const evaln = sub ? await Evaluation.findOne({ projectSubmissionId: sub._id }) : null
      const attempts = await AssessmentAttempt.find({ studentId: u._id, status: 'submitted' })
      const attemptsCount = attempts.length
      const assessment = attemptsCount
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attemptsCount)
        : null
      const project = evaln ? evaln.totalScore : null
      const parts = [assessment, project].filter((v) => v != null)
      const overall = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        registeredAt: u.createdAt,
        assessmentsAttempted: attemptsCount,
        project: sub?.projectName || null,
        assessmentScore: assessment,
        projectScore: project,
        overallScore: overall,
        status: !sub ? 'No submission' : evaln ? 'Evaluated' : sub.submissionStatus,
      }
    }),
  )
  res.json({ students: rows })
}

export async function evaluators(_req, res) {
  const list = await User.find({ role: 'evaluator' }).sort({ createdAt: 1 })
  const pendingTotal = await ProjectSubmission.countDocuments({
    submissionStatus: { $in: ['submitted', 'under_review'] },
  })
  const rows = await Promise.all(
    list.map(async (u) => {
      const done = await Evaluation.find({ evaluatorId: u._id })
      const avg = done.length
        ? Math.round(done.reduce((s, e) => s + e.totalScore, 0) / done.length)
        : null
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        registeredAt: u.createdAt,
        evaluationsCompleted: done.length,
        pendingEvaluations: pendingTotal,
        averageEvaluationScore: avg,
      }
    }),
  )
  res.json({ evaluators: rows })
}

export async function evaluations(_req, res) {
  const list = await Evaluation.find()
    .populate('studentId', 'name')
    .populate('evaluatorId', 'name')
    .populate({ path: 'projectSubmissionId', select: 'projectName' })
    .sort({ updatedAt: -1 })
  res.json({
    evaluations: list.map((e) => ({
      id: e._id,
      student: e.studentId?.name || '—',
      project: e.projectSubmissionId?.projectName || '—',
      evaluator: e.evaluatorId?.name || '—',
      score: e.totalScore,
      status: 'Completed',
      date: e.updatedAt,
    })),
  })
}

export async function getCriteria(_req, res) {
  const doc = await getActiveCriteria()
  res.json({ criteria: doc.items })
}

export async function updateCriteria(req, res) {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  const clean = items
    .map((c) => ({ name: String(c.name || '').trim(), max: Math.max(0, Math.round(Number(c.max) || 0)) }))
    .filter((c) => c.name)
  const total = clean.reduce((s, c) => s + c.max, 0)
  if (total !== 100) {
    return res.status(400).json({ error: `Rubric total must equal 100 (got ${total}).` })
  }
  const doc = await getActiveCriteria()
  doc.items = clean
  await doc.save()
  res.json({ criteria: doc.items })
}
