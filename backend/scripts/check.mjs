// Offline backend sanity check: module wiring + ZIP analysis + rule-based AI.
// Does NOT require MongoDB.
import express from 'express'
import JSZip from 'jszip'

import authRoutes from '../routes/auth.js'
import adminRoutes from '../routes/admin.js'
import studentRoutes from '../routes/student.js'
import evaluatorRoutes from '../routes/evaluator.js'
import syllabiRoutes from '../routes/syllabi.js'
import questionRoutes from '../routes/questions.js'
import assessmentRoutes from '../routes/assessments.js'
import projectRoutes from '../routes/projects.js'
import resultRoutes from '../routes/results.js'
import dashboardRoutes from '../routes/dashboard.js'
import { analyzeZipBuffer } from '../services/projectAnalyzer.js'
import { evaluateProject } from '../services/mockAI.js'
import { generateFromSyllabus } from '../services/questionGenerator.js'
import { parseSyllabusText } from '../services/syllabusParser.js'
import '../models/User.js'
import '../models/ProjectSubmission.js'
import '../models/Evaluation.js'
import '../models/Syllabus.js'
import '../models/Question.js'
import '../models/Assessment.js'
import '../models/AssessmentAttempt.js'
import '../models/Project.js'
import { DEFAULT_CRITERIA } from '../models/Criteria.js'

const app = express()
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/evaluator', evaluatorRoutes)
app.use('/api/syllabi', syllabiRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/assessments', assessmentRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/dashboard', dashboardRoutes)
console.log('routes mounted OK')

// syllabus parse + deterministic question generation
const parsedUnits = parseSyllabusText(
  'Unit 1: Web Basics\nHTML, CSS, HTTP\nUnit 2: JavaScript\nVariables, Functions, DOM\nUnit 3: React\nComponents, Hooks, Router',
)
const gen = generateFromSyllabus({
  syllabus: { subject: 'Web Development', units: parsedUnits },
  unit: 'all',
  topic: 'all',
  count: 6,
  difficulty: 'Mixed',
})
console.log('\nSYLLABUS PARSE + GENERATION')
console.log('  units parsed :', parsedUnits.length, '| topics:', parsedUnits.reduce((n, u) => n + u.topics.length, 0))
console.log('  generated    :', gen.length, 'questions | first correct:', gen[0].correctAnswer)
const genOk =
  parsedUnits.length >= 2 &&
  gen.length === 6 &&
  gen.every((q) => q.options.A && q.options.B && q.options.C && q.options.D && /[ABCD]/.test(q.correctAnswer))

const FILES = {
  'demo/package.json': JSON.stringify({
    name: 'demo', dependencies: { react: '^19', express: '^5', mongoose: '^9' },
    scripts: { dev: 'vite', server: 'node server.js' },
  }),
  'demo/README.md': '# Demo\n\n## Setup\n1. npm install\n2. npm run dev\n',
  'demo/.gitignore': 'node_modules\n.env\n',
  'demo/src/App.jsx': 'export default function App(){return null}\n',
  'demo/src/components/Header.jsx': 'export default () => null\n',
  'demo/src/components/Card.jsx': 'export default () => null\n',
  'demo/src/pages/Home.jsx': 'export default () => null\n',
  'demo/src/index.css': 'body{margin:0}\n',
  'demo/server/server.js': 'import express from "express"\n',
  'demo/server/routes/api.js': 'export default {}\n',
  'demo/server/models/User.js': 'export default {}\n',
  'demo/server/config/db.js': 'const uri = process.env.MONGO_URI\n',
}
const zip = new JSZip()
for (const [p, c] of Object.entries(FILES)) zip.file(p, c)
const buf = await zip.generateAsync({ type: 'nodebuffer' })

const analysis = await analyzeZipBuffer(buf, { projectName: 'Demo', fileName: 'demo.zip' })
console.log('\nANALYSIS')
console.log('  files/folders:', analysis.fileCount, '/', analysis.folderCount)
console.log('  technologies :', analysis.technologies.join(', '))
console.log('  detected     :', Object.entries(analysis.detected).filter(([, v]) => v).map(([k]) => k).join(', '))
console.log('  components   :', analysis.components.join(', '))
console.log('  models/routes:', analysis.models.join(','), '/', analysis.routes.join(','))
console.log('  secrets      :', analysis.secrets.length)

const ai = evaluateProject(analysis, DEFAULT_CRITERIA)
console.log('\nAI EVALUATION')
for (const c of ai.criteria) console.log(`  ${c.key.padEnd(20)} ${c.score}/${c.max}  (${c.evidence.length} evidence)`)
console.log('  TOTAL                ' + ai.total + '/' + ai.max)
console.log('  strengths/weak/recs :', ai.strengths.length, '/', ai.weaknesses.length, '/', ai.recommendations.length)
console.log('  skillProfile        :', ai.skillProfile.map((s) => `${s.label} ${s.value}%`).join(', '))

const pass =
  genOk &&
  analysis.fileCount >= 8 &&
  analysis.detected.reactFrontend &&
  analysis.detected.database &&
  ai.total > 30 && ai.total <= 100 &&
  ai.criteria.every((c) => c.evidence.length > 0 && c.reason)
console.log('\n' + (pass ? 'CHECK PASSED' : 'CHECK FAILED'))
process.exit(pass ? 0 : 1)
