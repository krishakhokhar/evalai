import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  dashboard,
  students,
  evaluators,
  evaluations,
  getCriteria,
  updateCriteria,
} from '../controllers/adminController.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/dashboard', dashboard)
router.get('/students', students)
router.get('/evaluators', evaluators)
router.get('/evaluations', evaluations)
router.get('/criteria', getCriteria)
router.put('/criteria', updateCriteria)

export default router
