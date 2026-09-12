import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as c from '../controllers/assessmentController.js'

const router = Router()
router.use(requireAuth)

// student
router.get('/mine', requireRole('student'), c.listForStudent)
router.post('/:id/start', requireRole('student'), c.start)
router.post('/:id/submit', requireRole('student'), c.submit)

// admin
router.get('/', requireRole('admin'), c.list)
router.post('/', requireRole('admin'), c.create)
router.get('/:id', requireRole('admin'), c.getOne)
router.put('/:id', requireRole('admin'), c.update)

export default router
