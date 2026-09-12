import { useRef, useState } from 'react'

// One common upload / dropzone used by BOTH the Syllabus page and the Project
// Task page. Accepts PDF, DOC, DOCX, TXT, XLS, XLSX, CSV.
export const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv'

export default function DocUpload({
  onFile,
  busy = false,
  label = 'Click to browse or drop a file here',
  busyLabel = 'Extracting content…',
  accept = DOC_ACCEPT,
}) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const pick = (file) => {
    if (!file) return
    onFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      className={`dropzone ${drag ? 'is-drag' : ''}`.trim()}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!busy) pick(e.dataTransfer.files?.[0])
      }}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => pick(e.target.files?.[0])} />
      <span>{busy ? busyLabel : label}</span>
    </div>
  )
}
