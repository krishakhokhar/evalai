// Real end-to-end test against an in-memory MongoDB.
// Exercises the actual Express app + controllers + models for the full flow:
//   syllabus -> questions -> assessment -> student attempts (randomized) -> score
//   -> project upload -> evaluation -> student results -> admin dashboard.
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import JSZip from 'jszip'

const mongo = await MongoMemoryServer.create()
process.env.MONGO_URI = mongo.getUri('evalai_e2e')
process.env.JWT_SECRET = 'test-secret'
process.env.ADMIN_EMAIL = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'Admin@12345'
process.env.PORT = '5099'

const server = await import('../server.js')

const BASE = 'http://localhost:5099/api'

// server.js starts listening immediately; whenReady() resolves once MongoDB is
// connected AND the one-time admin/criteria seed has run.
await server.whenReady()
for (let i = 0; i < 60 && mongoose.connection.readyState !== 1; i++) {
  await new Promise((r) => setTimeout(r, 250))
}

const j = async (path, { method = 'GET', body, token, form } = {}) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !form) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}
const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('  ok  -', msg)
}
const reg = (role, name, email) =>
  j(`/auth/register/${role}`, { method: 'POST', body: { name, email, password: 'pass1234', confirmPassword: 'pass1234' } })
const login = async (email, password = 'pass1234') =>
  (await j('/auth/login', { method: 'POST', body: { email, password } })).data.token

console.log('\n1. health + admin login')
{
  const h = await j('/health')
  assert(
    h.status === 200 && h.data.api === 'running' && h.data.database === 'connected' && h.data.success === true,
    `GET /api/health -> 200 { api: running, database: connected } (${JSON.stringify(h.data)})`,
  )
}
const adminToken = await login('admin@test.local', 'Admin@12345')
assert(!!adminToken, 'admin login -> token')

console.log('\n2. admin creates a syllabus (manual, with units/topics)')
let r = await j('/syllabi', {
  method: 'POST', token: adminToken,
  body: {
    title: 'Web Development 2026', subject: 'Web Development',
    units: [
      { name: 'Unit 1: Web Basics', topics: ['HTML', 'CSS', 'HTTP'] },
      { name: 'Unit 2: JavaScript', topics: ['Variables', 'Functions', 'DOM'] },
      { name: 'Unit 3: React', topics: ['Components', 'Hooks', 'Router'] },
    ],
  },
})
assert(r.status === 201 && r.data.syllabus.unitCount === 3 && r.data.syllabus.topicCount === 9, 'syllabus saved with 3 units / 9 topics')
const syllabusId = r.data.syllabus.id

console.log('\n2b. POST /api/syllabi/upload — the reported 403 (multipart + Bearer, admin/student/none)')
const s1Email = `s1_${Date.now()}@test.local`
await reg('student', 'Student One', s1Email)
const s1 = await login(s1Email)
const uploadForm = () => {
  const f = new FormData()
  f.append('file', new Blob(['Unit 1: Basics\nHTML, CSS\n'], { type: 'text/plain' }), 'syllabus.txt')
  return f
}
r = await j('/syllabi/upload', { method: 'POST', token: adminToken, form: uploadForm() })
assert(r.status === 201, `ADMIN upload -> ${r.status} ${r.status !== 201 ? JSON.stringify(r.data) : ''}`)
assert(r.data.syllabus.status === 'saved' && r.data.syllabus.source === 'upload', 'uploaded syllabus is auto-saved (no manual review step)')
{
  const uploadedId = r.data.syllabus.id
  const back = await j('/syllabi', { token: adminToken })
  assert(back.data.syllabi.some((s) => s.id === uploadedId && s.status === 'saved'), 'uploaded syllabus appears in the admin list ready for question generation')
}
r = await j('/syllabi/upload', { method: 'POST', token: s1, form: uploadForm() })
assert(r.status === 403, `STUDENT upload -> 403 (got ${r.status})`)
r = await j('/syllabi/upload', { method: 'POST', form: uploadForm() })
assert(r.status === 401, `no token upload -> 401 (got ${r.status})`)

console.log('\n3. SYLLABUS IS ADMIN-ONLY — students cannot reach it by any route')
assert((await j('/syllabi', { token: s1 })).status === 403, 'student GET /api/syllabi -> 403')
assert((await j(`/syllabi/${syllabusId}`, { token: s1 })).status === 403, 'student GET /api/syllabi/:id -> 403')
assert((await j('/syllabi/published', { token: s1 })).status === 403, 'student GET /api/syllabi/published -> 403 (blocked by the admin-only router)')
{
  const g = await j('/syllabi/published', { token: adminToken })
  assert(g.status !== 200 || !g.data?.syllabi, 'the /syllabi/published listing route is gone — it no longer returns a syllabi array')
}

console.log('\n3c. admin creates + publishes a PROJECT TASK; student sees it')
r = await j('/projects', {
  method: 'POST', token: adminToken,
  body: {
    title: 'Build a Student Management System',
    description: 'A MERN CRUD app for students, courses and attendance.',
    requirements: ['CRUD for students', 'JWT auth', 'README with setup'],
    instructions: 'Submit a single ZIP of the repo without node_modules.',
    techStack: 'React + Node + MongoDB',
    maxMarks: 100,
    status: 'draft',
  },
})
assert(r.status === 201 && r.data.project.status === 'draft', 'project task created as draft')
assert(r.data.project.instructions.length > 0 && r.data.project.maxMarks === 100, 'project task stores instructions + maxMarks')
const projectTaskId = r.data.project.id
assert((await j('/projects/published', { token: s1 })).data.projects.length === 0, 'draft project task not visible to student')
r = await j(`/projects/${projectTaskId}/publish`, { method: 'PATCH', token: adminToken, body: { published: true } })
assert(r.status === 200 && r.data.project.status === 'published', 'admin publishes the project task')
r = await j('/projects/published', { token: s1 })
assert(r.status === 200 && r.data.projects.length === 1 && r.data.projects[0].id === projectTaskId, 'student sees the published project task')
r = await j('/student/dashboard', { token: s1 })
assert(r.data.projectTask?.id === projectTaskId, 'student dashboard surfaces the published project task')
assert(
  !('publishedSyllabi' in r.data) && JSON.stringify(r.data).toLowerCase().indexOf('syllab') === -1,
  'student dashboard payload contains NO syllabus data whatsoever',
)
assert(r.data.summary && typeof r.data.summary.assignedProjects === 'number' && 'evaluationStatus' in r.data.summary, 'student dashboard has the summary block (assignedProjects, evaluationStatus, ...)')

console.log('\n3d. admin uploads a PROJECT BRIEF via the common upload -> draft -> review -> publish')
{
  const briefText = [
    'Title: Build a Blogging Platform',
    'Technology: React + Express + PostgreSQL',
    'Maximum marks: 100',
    'Deadline: 2026-12-01',
    '',
    'Overview:',
    'A full-stack blogging platform with posts, comments and tags.',
    '',
    'Requirements:',
    '- User registration and login',
    '- Create, edit and delete posts',
    '- Comment on posts',
    '- Tag-based filtering',
    '',
    'Instructions:',
    'Submit a single ZIP of the repository without node_modules.',
  ].join('\n')
  const briefForm = new FormData()
  briefForm.append('file', new Blob([briefText], { type: 'text/plain' }), 'blog-brief.txt')
  r = await j('/projects/upload', { method: 'POST', token: adminToken, form: briefForm })
  assert(r.status === 201 && r.data.project.status === 'draft', 'POST /api/projects/upload extracts a DRAFT project (never auto-published)')
  assert(
    r.data.project.title === 'Build a Blogging Platform' &&
      /React/.test(r.data.project.techStack) &&
      r.data.project.requirements.length === 4 &&
      r.data.project.fileName === 'blog-brief.txt',
    'brief parser fills title, techStack, 4 requirements and keeps the source file name',
  )
  const briefId = r.data.project.id
  // student cannot see it while it is a draft
  r = await j('/projects/published', { token: s1 })
  assert(!r.data.projects.some((p) => p.id === briefId), 'uploaded brief stays hidden from students until published')
  // admin reviews/edits then publishes
  r = await j(`/projects/${briefId}`, { method: 'PUT', token: adminToken, body: { requirements: 'User auth\nCRUD posts\nComments\nTags\nREADME', status: 'published' } })
  assert(r.status === 200 && r.data.project.status === 'published' && r.data.project.requirements.length === 5, 'admin edits the brief and publishes it')
  r = await j('/projects/published', { token: s1 })
  assert(r.data.projects.some((p) => p.id === briefId), 'student now sees the published uploaded brief')
  // Leave a single active published task for the rest of the flow (ZIP fallback link).
  await j(`/projects/${briefId}/publish`, { method: 'PATCH', token: adminToken, body: { published: false } })
  assert((await j('/projects/published', { token: s1 })).data.projects.length === 1, 'brief unpublished — one active published task remains')
}

console.log('\n4. admin generates MCQs FROM the syllabus, then approves them')
r = await j('/questions/generate', {
  method: 'POST', token: adminToken,
  body: { syllabusId, unit: 'all', topic: 'all', count: 10, difficulty: 'Mixed', persist: true },
})
assert(r.status === 201 && r.data.questions.length === 10, 'generated + persisted 10 questions')
assert(r.data.questions.every((q) => q.options.A && q.options.B && q.options.C && q.options.D && ['A', 'B', 'C', 'D'].includes(q.correctAnswer)), 'every generated question has 4 options + a valid correctAnswer')
assert(r.data.questions.every((q) => String(q.sourceSyllabusId) === String(syllabusId)), 'questions are linked to the source syllabus')
const questionIds = r.data.questions.map((q) => q.id)
for (const id of questionIds) {
  await j(`/questions/${id}/status`, { method: 'PATCH', token: adminToken, body: { status: 'approved' } })
}
r = await j('/questions?status=approved', { token: adminToken })
assert(r.data.questions.length === 10, 'all 10 questions now approved in the bank')

console.log('\n5. admin creates + publishes an assessment')
r = await j('/assessments', {
  method: 'POST', token: adminToken,
  body: {
    title: 'Web Dev Mid-term', description: 'Covers units 1-3.', syllabusId, subject: 'Web Development',
    questionIds, durationMinutes: 15, marksPerQuestion: 2, passingMarks: 8, difficulty: 'Mixed', status: 'published',
  },
})
assert(r.status === 201 && r.data.assessment.status === 'published', 'assessment published')
assert(r.data.assessment.totalMarks === 20 && r.data.assessment.passingMarks === 8, 'totalMarks 20, passingMarks 8')
const assessmentId = r.data.assessment.id

console.log('\n6. two students see the published assessment')
const s2Email = `s2_${Date.now()}@test.local`
await reg('student', 'Student Two', s2Email)
const s2 = await login(s2Email)
for (const [tok, who] of [[s1, 'Student One'], [s2, 'Student Two']]) {
  r = await j('/assessments/mine', { token: tok })
  assert(r.status === 200 && r.data.assessments.length === 1 && r.data.assessments[0].phase === 'available', `${who} sees 1 available assessment`)
}

console.log('\n7. each student gets a DIFFERENT randomized paper (stable on refresh)')
const startA1 = (await j(`/assessments/${assessmentId}/start`, { method: 'POST', token: s1 })).data.attempt
const startB1 = (await j(`/assessments/${assessmentId}/start`, { method: 'POST', token: s2 })).data.attempt
assert(startA1.questions.length === 10 && startB1.questions.length === 10, 'both papers have 10 questions')
assert(startA1.questions.every((q) => q.options.length === 4 && !('correctKey' in q)), 'paper hides the correct answer during the test')
const orderA = startA1.questions.map((q) => String(q.questionId)).join(',')
const orderB = startB1.questions.map((q) => String(q.questionId)).join(',')
assert(orderA !== orderB, 'Student One and Student Two received different question order')
const startA2 = (await j(`/assessments/${assessmentId}/start`, { method: 'POST', token: s1 })).data.attempt
assert(startA2.questions.map((q) => String(q.questionId)).join(',') === orderA, 'refreshing (re-start) returns the SAME paper for Student One')

console.log('\n8. students submit -> automatic scoring + topic breakdown')
// Student One: answer everything with the first option key
const answersA = Object.fromEntries(startA1.questions.map((q) => [String(q.questionId), q.options[0].key]))
r = await j(`/assessments/${assessmentId}/submit`, { method: 'POST', token: s1, body: { answers: answersA } })
assert(r.status === 200 && typeof r.data.result.percentage === 'number', `Student One scored ${r.data.result.score}/${r.data.result.totalMarks} (${r.data.result.percentage}%)`)
assert(r.data.result.topicBreakdown.length >= 3, 'result includes topic-wise breakdown')
assert(r.data.result.correctCount + r.data.result.incorrectCount === 10, 'correct + incorrect = 10')
// Student Two: leave blank -> score 0
r = await j(`/assessments/${assessmentId}/submit`, { method: 'POST', token: s2, body: { answers: {} } })
assert(r.status === 200 && r.data.result.score === 0 && r.data.result.percentage === 0, 'Student Two (no answers) scored 0%')

console.log('\n9. student result history (+ passing marks for grade / pass-fail)')
r = await j('/results', { token: s1 })
assert(r.status === 200 && r.data.results.length === 1 && r.data.results[0].assessmentTitle === 'Web Dev Mid-term', 'GET /api/results lists the submitted attempt')
assert(r.data.results[0].passingMarks === 8, 'result carries the assessment passing marks (frontend derives grade + pass/fail)')
r = await j(`/results/${r.data.results[0].attemptId}`, { token: s1 })
assert(r.status === 200 && Array.isArray(r.data.result.review) && r.data.result.review[0].correctKey, 'after submit, result review reveals correct answers')

console.log('\n10. student submits ONLY a ZIP for the assigned task (no name/tech/description)')
const zip = new JSZip()
zip.file('app/package.json', JSON.stringify({ name: 'app', dependencies: { react: '^19', express: '^5', mongoose: '^9' }, scripts: { dev: 'vite' } }))
zip.file('app/README.md', '# App\n## Setup\n1. npm install\n2. npm run dev\n')
zip.file('app/.gitignore', 'node_modules\n.env\n')
zip.file('app/src/App.jsx', 'export default () => null\n')
zip.file('app/src/components/Nav.jsx', 'export default () => null\n')
zip.file('app/src/components/List.jsx', 'export default () => null\n')
zip.file('app/src/pages/Home.jsx', 'export default () => null\n')
zip.file('app/server/routes/api.js', 'export default {}\n')
zip.file('app/server/models/Item.js', 'export default {}\n')
zip.file('app/server/config.js', 'const API_KEY = "abcd1234efgh5678"\n')
const zipBuf = await zip.generateAsync({ type: 'nodebuffer' })

// a submission that includes a real .env file is rejected for security
const envZip = new JSZip()
envZip.file('app/package.json', '{"name":"app"}')
envZip.file('app/.env', 'MONGO_URI=mongodb://secret\nJWT_SECRET=nope\n')
const envBuf = await envZip.generateAsync({ type: 'nodebuffer' })
const envFd = new FormData()
envFd.append('project', new Blob([envBuf], { type: 'application/zip' }), 'with-env.zip')
r = await j('/student/projects', { method: 'POST', token: s1, form: envFd })
assert(r.status === 400 && /\.env/.test(r.data.error), `zip containing .env is rejected (${r.data.error})`)

// a non-zip is rejected by the file filter
const nonZipFd = new FormData()
nonZipFd.append('project', new Blob(['not a zip'], { type: 'text/plain' }), 'notes.txt')
r = await j('/student/projects', { method: 'POST', token: s1, form: nonZipFd })
assert(r.status === 400 && /zip/i.test(r.data.error), 'non-.zip upload is rejected')

// student sends ONLY the zip — the brief (name/tech/description) comes from the task
const fd = new FormData()
fd.append('project', new Blob([zipBuf], { type: 'application/zip' }), 'real-project.zip')
r = await j('/student/projects', { method: 'POST', token: s1, form: fd })
assert(r.status === 201, 'POST /api/student/projects (clean zip only) -> 201')
assert(
  r.data.project.projectName === 'Build a Student Management System' &&
    String(r.data.project.projectId) === String(projectTaskId) &&
    r.data.project.maxMarks === 100,
  'submission auto-links to the published task; name/maxMarks pulled from it',
)
const analysis = r.data.project.analysis
assert(analysis.detected.reactFrontend && analysis.detected.apiRoutes, 'real react frontend + api routes detected from the zip')
assert(analysis.secrets.length >= 1 && JSON.stringify(analysis).indexOf('abcd1234efgh5678') === -1, 'secret flagged, value never exposed')

console.log('\n11. evaluator sees + evaluates the project (7 criteria)')
const eEmail = `eval_${Date.now()}@test.local`
await reg('evaluator', 'Real Evaluator', eEmail)
const evalToken = await login(eEmail)
r = await j('/evaluator/pending', { token: evalToken })
assert(r.data.projects.length === 1, 'evaluator sees 1 pending project')
assert(r.data.projects[0].projectTask === 'Build a Student Management System', 'evaluator sees which project task the submission is for')
const submissionId = r.data.projects[0].id
r = await j(`/evaluator/projects/${submissionId}`, { token: evalToken })
const ai = r.data.aiSuggested
assert(ai.criteria.length === 7 && ai.criteria.some((c) => c.key === 'Innovation'), 'AI suggests 7 criteria incl. Innovation')
assert(ai.criteria.every((c) => c.evidence.length && c.reason && c.recommendation), 'every criterion has evidence + reason + recommendation')
assert(r.data.project.brief && r.data.project.brief.requirements.length === 3, 'evaluator sees the admin project brief (requirements)')

// evaluator can download the actual submitted ZIP
r = await fetch('http://localhost:5099/api/evaluator/projects/' + submissionId + '/download', {
  headers: { Authorization: `Bearer ${evalToken}` },
})
const dlBuf = Buffer.from(await r.arrayBuffer())
assert(r.status === 200 && dlBuf.length === zipBuf.length, `evaluator downloads the real ZIP (${dlBuf.length} bytes)`)

const rubricScores = ai.criteria.map((c, i) => ({ key: c.key, score: i === 0 ? Math.max(0, c.score - 2) : c.score }))
const expectedTotal = rubricScores.reduce((s, c) => s + c.score, 0)
r = await j('/evaluator/evaluations', {
  method: 'POST', token: evalToken,
  body: {
    projectSubmissionId: submissionId,
    rubricScores,
    evaluatorComments: 'Notes.',
    strengths: 'Clean structure\nGood auth flow',
    weaknesses: 'Thin README\nNo tests',
    finalFeedback: 'Solid MERN build. Add tests and expand the README before the demo.',
  },
})
assert(r.status === 200 && r.data.evaluation.totalScore === expectedTotal, `evaluation saved (${expectedTotal}/100)`)

console.log('\n12. student sees the real project evaluation + evaluator-authored feedback')
r = await j('/student/results', { token: s1 })
assert(r.data.evaluation && r.data.evaluation.totalScore === expectedTotal, `student sees final project score ${expectedTotal}/100`)
assert(r.data.evaluation.rubricScores.length === 7 && r.data.evaluation.skillProfile.length > 0, 'student sees 7-criteria rubric + skill profile')
assert(
  r.data.evaluation.strengths[0] === 'Clean structure' &&
    r.data.evaluation.weaknesses[0] === 'Thin README' &&
    /Add tests/.test(r.data.evaluation.finalFeedback),
  'student sees the evaluator-authored strengths / weaknesses / final feedback (not the AI defaults)',
)
r = await j('/student/dashboard', { token: s1 })
assert(r.data.project.status === 'evaluated' && r.data.latestScore === expectedTotal, 'student dashboard shows the evaluated status + score')

console.log('\n13. admin dashboard = real aggregated data')
r = await j('/admin/dashboard', { token: adminToken })
assert(r.data.stats.totalStudents === 2 && r.data.stats.totalEvaluators === 1, 'admin: 2 students, 1 evaluator')
assert(r.data.stats.publishedAssessments === 1, 'admin: 1 published assessment')
assert(r.data.stats.submittedProjects === 1 && r.data.stats.completedEvaluations === 1, 'admin: 1 project, 1 completed evaluation')
assert(r.data.stats.averageScore > 0, `admin average score = ${r.data.stats.averageScore} (blends MCQ % + project score)`)
assert(
  r.data.analytics &&
    r.data.analytics.passFail.pass + r.data.analytics.passFail.fail === 2 &&
    r.data.analytics.evaluationProgress.completed === 1 &&
    Array.isArray(r.data.analytics.subjectPerformance),
  'admin dashboard returns real analytics (pass/fail, evaluation progress, subject performance)',
)
r = await j('/admin/students', { token: adminToken })
assert(r.data.students.length === 2 && r.data.students.some((s) => s.assessmentsAttempted === 1), 'admin students page shows real attempt counts')
r = await j('/admin/evaluators', { token: adminToken })
assert(r.data.evaluators.length === 1 && r.data.evaluators[0].evaluationsCompleted === 1, 'admin evaluators page shows real completion counts')

console.log('\n14. evaluator dashboard exposes real chart data (per-criterion avgs + score history)')
r = await j('/evaluator/dashboard', { token: evalToken })
assert(
  r.status === 200 &&
    r.data.completed === 1 &&
    Array.isArray(r.data.criteriaAverages) &&
    r.data.criteriaAverages.length === 7 &&
    r.data.criteriaAverages.every((c) => typeof c.avg === 'number' && typeof c.max === 'number') &&
    Array.isArray(r.data.scoreHistory) &&
    r.data.scoreHistory.length === 1,
  'GET /api/evaluator/dashboard returns criteriaAverages[7] + scoreHistory from real evaluations',
)

console.log('\nALL E2E CHECKS PASSED')
await mongoose.disconnect()
await mongo.stop()
process.exit(0)
