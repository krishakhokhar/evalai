import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { uploadDoc, runUpload } from '../middleware/upload.js'
import * as c from '../controllers/projectController.js'

const router = Router()
router.use(requireAuth)

// Any authenticated user — published project tasks only.
router.get('/published', c.listPublished)

// Admin only.
router.post('/upload', requireRole('admin'), runUpload(uploadDoc), c.uploadAndParse)
router.get('/', requireRole('admin'), c.list)
router.post('/', requireRole('admin'), c.create)
router.put('/:id', requireRole('admin'), c.update)
router.patch('/:id/publish', requireRole('admin'), c.setPublished)
router.delete('/:id', requireRole('admin'), c.remove)

// Keep last: /:id must not shadow /published or /upload.
router.get('/:id', c.getOne) // getOne enforces published-only for non-admins

export default router
