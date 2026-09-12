import { api } from './api'

// --- Student ---
export const studentDashboard = () => api('/student/dashboard')
export const listMyProjects = () => api('/student/projects')
export const myResults = () => api('/student/results')

export function submitProject({ projectName, technology, description, file, projectId }) {
  const form = new FormData()
  form.append('projectName', projectName || '')
  form.append('technology', technology || '')
  form.append('description', description || '')
  if (projectId) form.append('projectId', projectId)
  form.append('project', file)
  return api('/student/projects', { method: 'POST', body: form, isForm: true })
}

// --- Admin ---
export const adminDashboard = () => api('/admin/dashboard')
export const adminStudents = () => api('/admin/students')
export const adminEvaluators = () => api('/admin/evaluators')
export const adminEvaluations = () => api('/admin/evaluations')
export const adminCriteria = () => api('/admin/criteria')
export const updateCriteria = (items) => api('/admin/criteria', { method: 'PUT', body: { items } })
