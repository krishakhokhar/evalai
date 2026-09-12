import { useRef, useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { listMyProjects, submitProject } from '../../services/projectApi'
import { listPublishedProjectTasks } from '../../services/academicApi'

const statusLabel = { submitted: 'Submitted', under_review: 'Under Evaluation', evaluated: 'Evaluated' }
const statusVariant = { submitted: 'warning', under_review: 'info', evaluated: 'success' }

export default function StudentProjectSubmission() {
  const mine = useResource(listMyProjects, [])
  const tasks = useResource(listPublishedProjectTasks, [])
  const [taskId, setTaskId] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const inputRef = useRef(null)

  const taskList = tasks.data?.projects ?? []
  const activeTask = taskList.find((t) => t.id === taskId) || taskList[0] || null
  const projects = mine.data?.projects ?? []

  const pickFile = (f) => {
    if (!f) return
    if (!/\.zip$/i.test(f.name)) {
      setNote({ type: 'error', text: 'Only a .zip archive is accepted.' })
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setNote({ type: 'error', text: 'File is larger than the 50 MB limit.' })
      return
    }
    setNote(null)
    setFile(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!activeTask) {
      setNote({ type: 'error', text: 'No project task is available.' })
      return
    }
    if (!file) {
      setNote({ type: 'error', text: 'Select your project ZIP first.' })
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const res = await submitProject({ projectId: activeTask.id, file })
      const a = res.project.analysis
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      setNote({
        type: 'success',
        text: `Submitted for "${activeTask.title}". Detected ${a.fileCount} files, ${a.folderCount} folders — ${a.technologies.join(', ')}.`,
      })
      mine.reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message || 'Upload failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Project Submission"
        subtitle="Build the assigned project task and upload it as a ZIP. Nothing else to fill in."
      />

      <AsyncBlock loading={tasks.loading} error={tasks.error} onRetry={tasks.reload} loadingText="Loading your assigned project…">
        {taskList.length === 0 ? (
          <Card>
            <EmptyState title="No project task published yet" message="Your instructor has not published a project task. Check back later." />
          </Card>
        ) : (
          <>
            <Card
              title="Assigned project"
              style={{ marginBottom: 20 }}
              actions={
                taskList.length > 1 && (
                  <select className="input" style={{ width: 220 }} value={activeTask?.id || ''} onChange={(e) => setTaskId(e.target.value)}>
                    {taskList.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                )
              }
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{activeTask.title}</div>
              <ul className="list-plain kv" style={{ marginBottom: 12 }}>
                {activeTask.techStack && <li><span className="muted">Technology / Stack</span><span>{activeTask.techStack}</span></li>}
                {activeTask.deadline && <li><span className="muted">Deadline</span><span>{new Date(activeTask.deadline).toLocaleDateString()}</span></li>}
                <li><span className="muted">Maximum marks</span><span>{activeTask.maxMarks}</span></li>
                {activeTask.evaluationCriteria?.length > 0 && (
                  <li><span className="muted">Evaluation criteria</span><span>{activeTask.evaluationCriteria.join(', ')}</span></li>
                )}
              </ul>
              {activeTask.description && (
                <>
                  <div className="section-label">Description</div>
                  <p className="muted" style={{ marginBottom: 12 }}>{activeTask.description}</p>
                </>
              )}
              {activeTask.requirements?.length > 0 && (
                <>
                  <div className="section-label">Requirements</div>
                  <ul className="list-plain evidence" style={{ marginBottom: 12 }}>
                    {activeTask.requirements.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </>
              )}
              {activeTask.instructions && (
                <>
                  <div className="section-label">Instructions</div>
                  <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{activeTask.instructions}</p>
                </>
              )}
            </Card>

            <Card title="Submit your project" style={{ marginBottom: 20 }}>
              <form onSubmit={submit}>
                <div className="note" style={{ marginBottom: 16 }}>
                  Upload a <strong>.zip</strong> of your project only. Do not include
                  node_modules, dist, .git, or .env files. Maximum size: 50 MB.
                </div>
                <div className="field">
                  <label>Project ZIP</label>
                  <div
                    className="dropzone"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
                  >
                    <input ref={inputRef} type="file" accept=".zip" onChange={(e) => pickFile(e.target.files?.[0])} />
                    {file ? (
                      <span>Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)</span>
                    ) : (
                      <span>Click to browse or drag &amp; drop your <strong>.zip</strong> · max 50 MB</span>
                    )}
                  </div>
                </div>
                {note && (
                  <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginBottom: 16 }}>{note.text}</div>
                )}
                <Button type="submit" disabled={busy}>{busy ? 'Uploading & analyzing…' : 'Submit Project'}</Button>
              </form>
            </Card>
          </>
        )}
      </AsyncBlock>

      <AsyncBlock loading={mine.loading} error={mine.error} onRetry={mine.reload} loadingText="Loading your submissions…">
        <Card title="Your submissions" flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Task</th><th>File</th><th>Size</th><th>Submitted</th><th>Status</th><th>Score</th></tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr><td colSpan={6} className="muted">Not submitted yet.</td></tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id}>
                      <td>{p.projectTitle || p.projectName}</td>
                      <td className="muted">{p.fileName}</td>
                      <td className="muted">{(p.fileSize / 1024).toFixed(0)} KB</td>
                      <td className="muted">{new Date(p.submittedAt).toLocaleDateString()}</td>
                      <td><Badge variant={statusVariant[p.status] || 'neutral'}>{statusLabel[p.status] || p.status}</Badge></td>
                      <td>{p.status === 'evaluated' && p.score != null ? `${p.score}/${p.maxMarks || 100}` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </AsyncBlock>
    </>
  )
}
