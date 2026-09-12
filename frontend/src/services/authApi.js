import { api } from './api'

export const registerStudent = (payload) =>
  api('/auth/register/student', { method: 'POST', body: payload, auth: false })

export const registerEvaluator = (payload) =>
  api('/auth/register/evaluator', { method: 'POST', body: payload, auth: false })

export const login = (email, password) =>
  api('/auth/login', { method: 'POST', body: { email, password }, auth: false })

export const fetchMe = () => api('/auth/me')
