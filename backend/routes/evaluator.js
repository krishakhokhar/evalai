import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  dashboard,
  pending,
  completed,
  projectById,
  downloadZip,
  submitEvaluation,
  updateEvaluation,
} from '../controllers/evaluatorController.js'

const router = Router()
router.use(requireAuth, requireRole('evaluator'))

router.get('/dashboard', dashboard)
router.get('/pending', pending)
router.get('/completed', completed)
router.get('/projects/:id/download', downloadZip)
router.get('/projects/:id', projectById)
router.post('/evaluations', submitEvaluation)
router.put('/evaluations/:id', updateEvaluation)

export default router
