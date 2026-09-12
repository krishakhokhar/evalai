import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { uploadZip, runUpload } from '../middleware/upload.js'
import {
  dashboard,
  createProject,
  listProjects,
  results,
} from '../controllers/studentController.js'

const router = Router()
router.use(requireAuth, requireRole('student'))

router.get('/dashboard', dashboard)
router.get('/projects', listProjects)
router.post('/projects', runUpload(uploadZip), createProject)
router.get('/results', results) // project-evaluation result (MCQ results live at /api/results)

export default router
