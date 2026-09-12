import fs from 'node:fs'
import ProjectSubmission from '../models/ProjectSubmission.js'
import Evaluation from '../models/Evaluation.js'
import Assessment from '../models/Assessment.js'
import AssessmentAttempt from '../models/AssessmentAttempt.js'
import Project from '../models/Project.js'
import { analyzeZipBuffer } from '../services/projectAnalyzer.js'
// NOTE: the Syllabus model is intentionally NOT imported here. Syllabus is an
// admin-only internal resource and must never be exposed through any student API.

function publicSubmission(s) {
  return {
    id: s._id,
    projectId: s.projectId || null,
    projectTitle: s.projectTitle || '',
    projectName: s.projectName,
    technology: s.technology,
    description: s.description,
    fileName: s.originalFileName,
    fileSize: s.fileSize,
    status: s.submissionStatus,
    submittedAt: s.submittedAt,
    score: s.score ?? null,
    maxMarks: s.maxMarks ?? 100,
    feedback: s.feedback || '',
    analysis: s.projectAnalysis || null,
  }
}

export async function dashboard(req, res) {
  const studentId = req.user._id

  const [submissions, attempts, publishedAssessmentCount, publishedProjectCount, activeProject] =
    await Promise.all([
      ProjectSubmission.find({ studentId }).sort({ submittedAt: -1 }),
      AssessmentAttempt.find({ studentId, status: 'submitted' }).sort({ submittedAt: -1 }),
      Assessment.countDocuments({ status: 'published' }),
      Project.countDocuments({ status: 'published' }),
      Project.findOne({ status: 'published' }).sort({ publishedAt: -1 }),
    ])

  const submission = submissions[0] || null
  const evaluation = submission
    ? await Evaluation.findOne({ projectSubmissionId: submission._id }).populate('evaluatorId', 'name')
    : null

  const attemptedIds = new Set(attempts.map((a) => String(a.assessmentId)))
  const mcqScores = attempts.map((a) => a.percentage)
  const projectPct =
    evaluation != null
      ? Math.round((evaluation.totalScore / (evaluation.maxMarks || submission.maxMarks || 100)) * 100)
      : null
  const scorePool = [...mcqScores, ...(projectPct != null ? [projectPct] : [])]
  const averageScore = scorePool.length
    ? Math.round(scorePool.reduce((s, v) => s + v, 0) / scorePool.length)
    : null

  const evaluationStatus = !submission
    ? 'No project submitted'
    : submission.submissionStatus === 'evaluated'
      ? 'Evaluated'
      : submission.submissionStatus === 'under_review'
        ? 'Under evaluation'
        : 'Awaiting evaluation'

  // Recent activity — real events only, newest first.
  const activity = []
  attempts.slice(0, 5).forEach((a) =>
    activity.push({
      type: 'assessment',
      text: `Completed an assessment — scored ${a.percentage}%`,
      at: a.submittedAt,
    }),
  )
  submissions.slice(0, 5).forEach((s) => {
    activity.push({ type: 'submission', text: `Submitted project "${s.projectTitle || s.projectName}"`, at: s.submittedAt })
    if (s.submissionStatus === 'evaluated' && s.score != null) {
      activity.push({
        type: 'evaluation',
        text: `Project evaluated — ${s.score}/${s.maxMarks || 100}`,
        at: s.updatedAt || s.submittedAt,
      })
    }
  })
  activity.sort((a, b) => new Date(b.at) - new Date(a.at))

  res.json({
    student: { name: req.user.name, email: req.user.email },
    summary: {
      availableAssessments: Math.max(0, publishedAssessmentCount - attemptedIds.size),
      completedAssessments: attempts.length,
      assignedProjects: publishedProjectCount,
      submittedProjects: submissions.length,
      averageScore,
      evaluationStatus,
    },
    // kept for backwards compatibility with any existing widgets
    project: submission ? publicSubmission(submission) : null,
    projectStatus: submission ? submission.submissionStatus : null,
    latestScore: evaluation ? evaluation.totalScore : null,
    assessment: attempts[0]
      ? {
          percent: attempts[0].percentage,
          correct: attempts[0].correctCount,
          total: attempts[0].questions.length,
        }
      : null,
    completedAssessments: attempts.length,
    openAssessments: Math.max(0, publishedAssessmentCount - attemptedIds.size),
    recentActivity: activity.slice(0, 8),
    performance: {
      averageScore,
      history: [...attempts].reverse().map((a, i) => ({ label: `#${i + 1}`, value: a.percentage })),
      projectScore: projectPct,
    },
    projectTask: activeProject
      ? {
          id: activeProject._id,
          title: activeProject.title,
          description: activeProject.description,
          techStack: activeProject.techStack,
          deadline: activeProject.deadline,
          requirements: activeProject.requirements,
          instructions: activeProject.instructions,
          maxMarks: activeProject.maxMarks,
          evaluationCriteria: activeProject.evaluationCriteria,
        }
      : null,
  })
}

export async function createProject(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'A .zip project file is required.' })
  }
  const cleanup = () => fs.promises.unlink(req.file.path).catch(() => {})
  const { projectId } = req.body || {}

  // The project brief comes from the admin-authored task — the student uploads
  // only the ZIP. Use the given projectId, else the single active published task.
  let linkedProject = projectId
    ? await Project.findById(projectId)
    : await Project.findOne({ status: 'published' }).sort({ publishedAt: -1 })

  if (!linkedProject || linkedProject.status !== 'published') {
    cleanup()
    return res.status(400).json({ error: 'No project task has been published for submission.' })
  }
  const projectName = linkedProject.title
  const technology = linkedProject.techStack
  const description = linkedProject.description

  let analysis
  try {
    const buffer = await fs.promises.readFile(req.file.path)
    analysis = await analyzeZipBuffer(buffer, {
      projectName: String(projectName).trim(),
      fileName: req.file.originalname,
    })
  } catch (err) {
    cleanup()
    return res.status(400).json({ error: err.message || 'Could not analyze the ZIP archive.' })
  }

  // Security: never accept an environment file inside a submission.
  if (analysis.envFiles?.length) {
    cleanup()
    return res.status(400).json({
      error: `Remove ${analysis.envFiles.join(', ')} and re-zip. Do not include node_modules, dist, .git, or .env files.`,
    })
  }

  const submission = await ProjectSubmission.create({
    studentId: req.user._id,
    projectId: linkedProject._id,
    projectTitle: linkedProject.title,
    projectName,
    technology: technology?.trim() || analysis.technologies.join(' + '),
    description: description?.trim() || '',
    maxMarks: linkedProject.maxMarks || 100,
    originalFileName: req.file.originalname,
    filePath: req.file.path,
    fileSize: req.file.size,
    submissionStatus: 'submitted',
    projectAnalysis: analysis,
    submittedAt: new Date(),
  })

  res.status(201).json({ project: publicSubmission(submission) })
}

export async function listProjects(req, res) {
  const list = await ProjectSubmission.find({ studentId: req.user._id }).sort({ submittedAt: -1 })
  res.json({ projects: list.map(publicSubmission) })
}

export async function results(req, res) {
  const submission = await ProjectSubmission.findOne({ studentId: req.user._id }).sort({
    submittedAt: -1,
  })
  if (!submission) {
    return res.json({ hasProject: false, evaluation: null })
  }
  const evaluation = await Evaluation.findOne({ projectSubmissionId: submission._id }).populate(
    'evaluatorId',
    'name',
  )
  const attempt = await AssessmentAttempt.find({ studentId: req.user._id, status: 'submitted' })
    .sort({ percentage: -1 })
    .limit(1)

  res.json({
    hasProject: true,
    project: publicSubmission(submission),
    assessment: attempt[0] ? { percent: attempt[0].percentage } : null,
    evaluation: evaluation
      ? {
          totalScore: evaluation.totalScore,
          max: evaluation.maxMarks || submission.maxMarks || 100,
          percentage: Math.round(
            (evaluation.totalScore / (evaluation.maxMarks || submission.maxMarks || 100)) * 100,
          ),
          rubricScores: evaluation.rubricScores,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendations: evaluation.recommendations,
          skillProfile: evaluation.skillProfile,
          evaluatorComments: evaluation.evaluatorComments,
          finalFeedback: evaluation.finalFeedback || evaluation.evaluatorComments,
          evaluatorName: evaluation.evaluatorId?.name || 'Evaluator',
          aiSuggestedTotal: evaluation.aiSuggested?.total ?? null,
          updatedAt: evaluation.updatedAt,
        }
      : null,
  })
}
