import { api } from './api'

// ---------- Syllabi (ADMIN ONLY — never called from any student page) ----------
export const listSyllabi = () => api('/syllabi')
export const getSyllabus = (id) => api(`/syllabi/${id}`)
export const createSyllabus = (payload) => api('/syllabi', { method: 'POST', body: payload })
export const updateSyllabus = (id, payload) => api(`/syllabi/${id}`, { method: 'PUT', body: payload })
export const deleteSyllabus = (id) => api(`/syllabi/${id}`, { method: 'DELETE' })
export function uploadSyllabus({ file, title, subject }) {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  if (subject) form.append('subject', subject)
  return api('/syllabi/upload', { method: 'POST', body: form, isForm: true })
}

// ---------- Question bank (admin) ----------
export const listQuestions = (query = '') => api(`/questions${query}`)
export const createQuestions = (questions) => api('/questions', { method: 'POST', body: { questions } })
export const updateQuestion = (id, patch) => api(`/questions/${id}`, { method: 'PUT', body: patch })
export const setQuestionStatus = (id, status) =>
  api(`/questions/${id}/status`, { method: 'PATCH', body: { status } })
export const deleteQuestion = (id) => api(`/questions/${id}`, { method: 'DELETE' })
export const generateQuestions = (payload) =>
  api('/questions/generate', { method: 'POST', body: payload })
export function importQuestions({ file, subject, syllabusId }) {
  const form = new FormData()
  form.append('file', file)
  if (subject) form.append('subject', subject)
  if (syllabusId) form.append('syllabusId', syllabusId)
  return api('/questions/import', { method: 'POST', body: form, isForm: true })
}

// ---------- Assessments ----------
export const listAssessments = () => api('/assessments')
export const getAssessment = (id) => api(`/assessments/${id}`)
export const createAssessment = (payload) => api('/assessments', { method: 'POST', body: payload })
export const updateAssessment = (id, payload) =>
  api(`/assessments/${id}`, { method: 'PUT', body: payload })

// student
export const myAssessments = () => api('/assessments/mine')
export const startAssessment = (id) => api(`/assessments/${id}/start`, { method: 'POST' })
export const submitAssessment = (id, answers) =>
  api(`/assessments/${id}/submit`, { method: 'POST', body: { answers } })

// student results (MCQ)
export const myMcqResults = () => api('/results')
export const mcqResult = (id) => api(`/results/${id}`)

// ---------- Project tasks (admin-authored) ----------
export const listProjectTasks = () => api('/projects')
export const createProjectTask = (payload) => api('/projects', { method: 'POST', body: payload })
export function uploadProjectBrief({ file }) {
  const form = new FormData()
  form.append('file', file)
  return api('/projects/upload', { method: 'POST', body: form, isForm: true })
}
export const updateProjectTask = (id, payload) =>
  api(`/projects/${id}`, { method: 'PUT', body: payload })
export const setProjectTaskPublished = (id, published) =>
  api(`/projects/${id}/publish`, { method: 'PATCH', body: { published } })
export const deleteProjectTask = (id) => api(`/projects/${id}`, { method: 'DELETE' })
// students / evaluators
export const listPublishedProjectTasks = () => api('/projects/published')
export const getProjectTask = (id) => api(`/projects/${id}`)
