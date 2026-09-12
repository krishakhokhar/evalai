import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { dashboard as adminDash } from '../controllers/adminController.js'
import { dashboard as studentDash } from '../controllers/studentController.js'
import { dashboard as evaluatorDash } from '../controllers/evaluatorController.js'

const router = Router()
router.use(requireAuth)

// GET /api/dashboard/stats — role-aware
router.get('/stats', (req, res, next) => {
  if (req.user.role === 'admin') return adminDash(req, res, next)
  if (req.user.role === 'evaluator') return evaluatorDash(req, res, next)
  return studentDash(req, res, next)
})

export default router
