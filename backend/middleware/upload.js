import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import multer from 'multer'

const UPLOAD_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'uploads',
)
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export { UPLOAD_DIR }

const randomName = (ext) => `${crypto.randomBytes(12).toString('hex')}${ext}`

// --- Project ZIP upload (student) ---
export const MAX_ZIP_BYTES = 50 * 1024 * 1024 // 50 MB

const zipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, randomName('.zip')),
})

function zipFilter(_req, file, cb) {
  const okExt = /\.zip$/i.test(file.originalname)
  const okMime = /zip/i.test(file.mimetype) || file.mimetype === 'application/octet-stream'
  if (okExt && okMime) return cb(null, true)
  cb(new Error('Only .zip archives are accepted.'))
}

export const uploadZip = multer({
  storage: zipStorage,
  fileFilter: zipFilter,
  limits: { fileSize: MAX_ZIP_BYTES, files: 1 },
}).single('project')

// --- Document upload (admin: syllabus / question import) ---
const DOC_EXT = /\.(pdf|doc|docx|txt|csv|md|xls|xlsx)$/i

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '').toLowerCase().match(DOC_EXT) || ['.bin'])[0]
    cb(null, randomName(ext))
  },
})

function docFilter(_req, file, cb) {
  if (DOC_EXT.test(file.originalname || '')) return cb(null, true)
  cb(new Error('Supported: PDF, DOC, DOCX, TXT, XLS, XLSX, CSV.'))
}

export const uploadDoc = multer({
  storage: docStorage,
  fileFilter: docFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('file')

// wrap a multer middleware so its errors become clean JSON
export function runUpload(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large. Maximum ZIP size is 50 MB.'
            : err.message
        return res.status(400).json({ error: msg })
      }
      next()
    })
  }
}
