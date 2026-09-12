import Assessment from '../models/Assessment.js'
import Question from '../models/Question.js'
import AssessmentAttempt from '../models/AssessmentAttempt.js'

// ---------- helpers ----------
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const adminView = (a) => ({
  id: a._id,
  title: a.title,
  description: a.description,
  subject: a.subject,
  units: a.units,
  syllabusId: a.syllabusId,
  questionIds: a.questionIds,
  numQuestions: a.questionIds.length,
  durationMinutes: a.durationMinutes,
  marksPerQuestion: a.marksPerQuestion,
  totalMarks: a.totalMarks,
  passingMarks: a.passingMarks,
  difficulty: a.difficulty,
  startAt: a.startAt,
  endAt: a.endAt,
  status: a.status,
  createdAt: a.createdAt,
})

// ---------- admin ----------
export async function list(_req, res) {
  const rows = await Assessment.find().sort({ createdAt: -1 })
  res.json({ assessments: rows.map(adminView) })
}

export async function getOne(req, res) {
  const a = await Assessment.findById(req.params.id).populate('questionIds')
  if (!a) return res.status(404).json({ error: 'Assessment not found.' })
  res.json({
    assessment: {
      ...adminView(a),
      questions: a.questionIds.map((q) => ({
        id: q._id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        topic: q.topic,
        difficulty: q.difficulty,
        marks: q.marks,
      })),
    },
  })
}

export async function create(req, res) {
  const {
    title, description, syllabusId, subject, units, questionIds,
    durationMinutes, marksPerQuestion, passingMarks, difficulty, startAt, endAt, status,
  } = req.body || {}

  if (!title || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.status(400).json({ error: 'Title and at least one question are required.' })
  }
  const questions = await Question.find({ _id: { $in: questionIds } })
  if (questions.length === 0) return res.status(400).json({ error: 'No valid questions selected.' })

  const mpq = Number(marksPerQuestion) > 0 ? Number(marksPerQuestion) : 1
  const total = questions.length * mpq
  const doc = await Assessment.create({
    title: String(title).trim(),
    description: String(description || '').trim(),
    syllabusId: syllabusId || undefined,
    subject: subject || questions[0].subject || '',
    units: Array.isArray(units) ? units : [],
    questionIds: questions.map((q) => q._id),
    numQuestions: questions.length,
    durationMinutes: Number(durationMinutes) > 0 ? Number(durationMinutes) : 20,
    marksPerQuestion: mpq,
    totalMarks: total,
    passingMarks: Number(passingMarks) >= 0 ? Number(passingMarks) : Math.round(total * 0.4),
    difficulty: ['Easy', 'Medium', 'Hard', 'Mixed'].includes(difficulty) ? difficulty : 'Mixed',
    startAt: startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
    status: ['draft', 'published', 'closed'].includes(status) ? status : 'draft',
    createdBy: req.user._id,
  })
  // publishing an assessment also publishes its questions
  if (doc.status === 'published') {
    await Question.updateMany({ _id: { $in: doc.questionIds } }, { status: 'published' })
  }
  res.status(201).json({ assessment: adminView(doc) })
}

export async function update(req, res) {
  const a = await Assessment.findById(req.params.id)
  if (!a) return res.status(404).json({ error: 'Assessment not found.' })
  const b = req.body || {}
  if (b.title != null) a.title = String(b.title).trim()
  if (b.durationMinutes != null) a.durationMinutes = Number(b.durationMinutes) || a.durationMinutes
  if (b.marksPerQuestion != null) a.marksPerQuestion = Number(b.marksPerQuestion) || a.marksPerQuestion
  if (b.description != null) a.description = String(b.description).trim()
  if (Array.isArray(b.questionIds) && b.questionIds.length) a.questionIds = b.questionIds
  if (b.startAt !== undefined) a.startAt = b.startAt ? new Date(b.startAt) : null
  if (b.endAt !== undefined) a.endAt = b.endAt ? new Date(b.endAt) : null
  if (['draft', 'published', 'closed'].includes(b.status)) a.status = b.status
  a.numQuestions = a.questionIds.length
  a.totalMarks = a.questionIds.length * a.marksPerQuestion
  if (b.passingMarks != null) a.passingMarks = Math.max(0, Number(b.passingMarks) || 0)
  await a.save()
  if (a.status === 'published') {
    await Question.updateMany({ _id: { $in: a.questionIds } }, { status: 'published' })
  }
  res.json({ assessment: adminView(a) })
}

// ---------- student ----------
function studentCard(a, attempt) {
  const now = Date.now()
  let phase = 'available'
  if (a.startAt && now < +a.startAt) phase = 'upcoming'
  if (a.endAt && now > +a.endAt) phase = 'closed'
  if (attempt?.status === 'submitted') phase = 'completed'
  return {
    id: a._id,
    title: a.title,
    description: a.description,
    subject: a.subject,
    numQuestions: a.questionIds.length,
    durationMinutes: a.durationMinutes,
    totalMarks: a.totalMarks,
    passingMarks: a.passingMarks,
    difficulty: a.difficulty,
    startAt: a.startAt,
    endAt: a.endAt,
    phase,
    attempt: attempt
      ? { id: attempt._id, status: attempt.status, score: attempt.score, percentage: attempt.percentage }
      : null,
  }
}

export async function listForStudent(req, res) {
  const rows = await Assessment.find({ status: 'published' }).sort({ createdAt: -1 })
  const attempts = await AssessmentAttempt.find({ studentId: req.user._id })
  const byA = new Map(attempts.map((t) => [String(t.assessmentId), t]))
  res.json({ assessments: rows.map((a) => studentCard(a, byA.get(String(a._id)))) })
}

// POST /api/assessments/:id/start  -> per-student randomized paper (idempotent)
export async function start(req, res) {
  const a = await Assessment.findById(req.params.id).populate('questionIds')
  if (!a || a.status !== 'published') {
    return res.status(404).json({ error: 'Assessment not available.' })
  }
  if (a.startAt && Date.now() < +a.startAt) return res.status(403).json({ error: 'This assessment has not started yet.' })
  if (a.endAt && Date.now() > +a.endAt) return res.status(403).json({ error: 'This assessment is closed.' })

  let attempt = await AssessmentAttempt.findOne({ studentId: req.user._id, assessmentId: a._id })
  if (attempt) return res.json({ attempt: attempt.toStudentView(attempt.status === 'submitted') })

  const ordered = a.shuffleQuestions ? shuffle(a.questionIds) : a.questionIds
  const questions = ordered.map((q) => {
    const entries = [
      ['A', q.options.A], ['B', q.options.B], ['C', q.options.C], ['D', q.options.D],
    ]
    const shown = a.shuffleOptions ? shuffle(entries) : entries
    const keys = ['A', 'B', 'C', 'D']
    const options = shown.map(([, text], i) => ({ key: keys[i], text }))
    const correctIdx = shown.findIndex(([origKey]) => origKey === q.correctAnswer)
    return {
      questionId: q._id,
      question: q.question,
      topic: q.topic,
      unit: q.unit,
      difficulty: q.difficulty,
      marks: a.marksPerQuestion || q.marks || 1,
      options,
      correctKey: keys[correctIdx],
      explanation: q.explanation,
    }
  })

  attempt = await AssessmentAttempt.create({
    studentId: req.user._id,
    assessmentId: a._id,
    questions,
    durationMinutes: a.durationMinutes,
    totalMarks: questions.reduce((s, q) => s + q.marks, 0),
    startedAt: new Date(),
  })
  res.status(201).json({ attempt: attempt.toStudentView(false) })
}

// POST /api/assessments/:id/submit  { answers: { questionId: key } }
export async function submit(req, res) {
  const attempt = await AssessmentAttempt.findOne({
    studentId: req.user._id,
    assessmentId: req.params.id,
  })
  if (!attempt) return res.status(404).json({ error: 'Start the assessment first.' })
  if (attempt.status === 'submitted') {
    return res.json({ result: resultView(attempt) })
  }

  const answers = req.body?.answers || {}
  let score = 0
  let correctCount = 0
  const topics = {}
  attempt.questions.forEach((q) => {
    const chosen = answers[String(q.questionId)]
    const t = q.topic || 'General'
    topics[t] = topics[t] || { correct: 0, total: 0 }
    topics[t].total += 1
    if (chosen && chosen === q.correctKey) {
      score += q.marks
      correctCount += 1
      topics[t].correct += 1
    }
  })
  attempt.answers = answers
  attempt.score = score
  attempt.correctCount = correctCount
  attempt.incorrectCount = attempt.questions.length - correctCount
  attempt.percentage = attempt.totalMarks ? Math.round((score / attempt.totalMarks) * 100) : 0
  attempt.topicBreakdown = Object.entries(topics).map(([topic, v]) => ({
    topic,
    correct: v.correct,
    total: v.total,
    percent: Math.round((v.correct / v.total) * 100),
  }))
  attempt.status = 'submitted'
  attempt.submittedAt = new Date()
  await attempt.save()
  res.json({ result: resultView(attempt) })
}

function resultView(attempt) {
  return {
    attemptId: attempt._id,
    assessmentId: attempt.assessmentId,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    totalQuestions: attempt.questions.length,
    topicBreakdown: attempt.topicBreakdown,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
  }
}

// GET /api/results  (student's own attempts)  &  /api/results/:id
export async function myResults(req, res) {
  const attempts = await AssessmentAttempt.find({
    studentId: req.user._id,
    status: 'submitted',
  })
    .populate({ path: 'assessmentId', select: 'title subject passingMarks' })
    .sort({ submittedAt: -1 })
  res.json({
    results: attempts.map((t) => ({
      ...resultView(t),
      assessmentTitle: t.assessmentId?.title || 'Assessment',
      subject: t.assessmentId?.subject || '',
      passingMarks: t.assessmentId?.passingMarks ?? 0,
    })),
  })
}

export async function resultById(req, res) {
  const t = await AssessmentAttempt.findOne({ _id: req.params.id, studentId: req.user._id })
    .populate({ path: 'assessmentId', select: 'title subject passingMarks' })
  if (!t || t.status !== 'submitted') return res.status(404).json({ error: 'Result not found.' })
  res.json({
    result: {
      ...resultView(t),
      assessmentTitle: t.assessmentId?.title || 'Assessment',
      subject: t.assessmentId?.subject || '',
      passingMarks: t.assessmentId?.passingMarks ?? 0,
      review: t.toStudentView(true).questions.map((q) => ({
        ...q,
        chosenKey: t.answers.get(String(q.questionId)) || null,
      })),
    },
  })
}
