// Extract readable text from an uploaded syllabus/question file.
// Degrades gracefully: if an optional parser package is missing or the format is
// binary-legacy (.doc), returns whatever text is recoverable plus a note.

import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_CHARS = 200_000

export async function extractText(filePath, originalName = '') {
  const ext = path.extname(originalName || filePath).toLowerCase()
  try {
    if (ext === '.txt' || ext === '.csv' || ext === '.md') {
      return clip(await fs.readFile(filePath, 'utf8'))
    }
    if (ext === '.docx') {
      const mammoth = (await import('mammoth')).default
      const { value } = await mammoth.extractRawText({ path: filePath })
      return clip(value)
    }
    if (ext === '.pdf') {
      // pdf-parse v2 exports a class (PDFParse), not the old v1 callable
      // default export — using the old `pdf(buffer)` call form throws
      // "pdf is not a function", which this file used to swallow silently,
      // making every PDF upload extract as empty text.
      const { PDFParse } = await import('pdf-parse')
      const buf = await fs.readFile(filePath)
      const parser = new PDFParse({ data: buf })
      try {
        const { text } = await parser.getText()
        return clip(text)
      } finally {
        await parser.destroy()
      }
    }
    if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = await import('xlsx')
      const wb = XLSX.readFile(filePath)
      const lines = []
      wb.SheetNames.forEach((name) => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
        rows.forEach((r) => {
          const line = r.filter((c) => c != null && String(c).trim()).join(', ')
          if (line) lines.push(line)
        })
      })
      return clip(lines.join('\n'))
    }
    if (ext === '.doc') {
      // Legacy binary Word — best effort: pull ASCII runs.
      const buf = await fs.readFile(filePath)
      const ascii = buf.toString('latin1').replace(/[^\x20-\x7E\n]+/g, ' ')
      return clip(ascii.replace(/\s{2,}/g, ' ').trim())
    }
  } catch (err) {
    return { text: '', note: `Could not extract text (${err.message}). Enter units/topics manually.` }
  }
  return { text: '', note: 'Unsupported file type for extraction. Enter units/topics manually.' }
}

function clip(text) {
  const t = (text || '').replace(/\r/g, '').slice(0, MAX_CHARS)
  return { text: t, note: t.trim() ? '' : 'No readable text found. Enter units/topics manually.' }
}
