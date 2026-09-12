import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { uploadDoc, runUpload } from '../middleware/upload.js'
import * as c from '../controllers/syllabusController.js'

const router = Router()

// Syllabus is an ADMIN-ONLY internal resource (used for AI question generation
// and as reference). It is NOT exposed to students or evaluators in any form —
// every route below requires the admin role.
router.use(requireAuth, requireRole('admin'))

router.get('/', c.list)
router.get('/:id', c.getOne)
router.post('/', c.create)
router.post('/upload', runUpload(uploadDoc), c.uploadAndParse)
router.put('/:id', c.update)
router.delete('/:id', c.remove)

export default router
