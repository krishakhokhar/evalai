import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { myResults, resultById } from '../controllers/assessmentController.js'

const router = Router()
router.use(requireAuth, requireRole('student'))

router.get('/', myResults)
router.get('/:id', resultById)

export default router
