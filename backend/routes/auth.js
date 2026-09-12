import { Router } from 'express'
import {
  registerStudent,
  registerEvaluator,
  login,
  me,
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register/student', registerStudent)
router.post('/register/evaluator', registerEvaluator)
router.post('/login', login)
router.get('/me', requireAuth, me)

export default router
