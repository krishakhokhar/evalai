import { api, downloadFile } from './api'

export const evaluatorDashboard = () => api('/evaluator/dashboard')
export const pendingEvaluations = () => api('/evaluator/pending')
export const completedEvaluations = () => api('/evaluator/completed')
export const evaluatorProject = (id) => api(`/evaluator/projects/${id}`)
export const downloadSubmissionZip = (id, filename) =>
  downloadFile(`/evaluator/projects/${id}/download`, filename || 'submission.zip')

export const submitEvaluation = (payload) =>
  api('/evaluator/evaluations', { method: 'POST', body: payload })
