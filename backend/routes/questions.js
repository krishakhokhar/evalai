import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { uploadDoc, runUpload } from '../middleware/upload.js'
import * as c from '../controllers/questionController.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/', c.list)
router.post('/', c.createMany)
router.post('/generate', c.generate)
router.post('/import', runUpload(uploadDoc), c.importFile)
router.put('/:id', c.update)
router.patch('/:id/status', c.setStatus)
router.delete('/:id', c.remove)

export default router
