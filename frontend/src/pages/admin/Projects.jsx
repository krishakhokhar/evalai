import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  setProjectTaskPublished,
  deleteProjectTask,
} from '../../services/academicApi'

const statusVariant = { draft: 'neutral', published: 'success', closed: 'warning' }
const blank = () => ({
  title: '',
  description: '',
  requirements: '',
  instructions: '',
  techStack: '',
  deadline: '',
  maxMarks: 100,
})

const toForm = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  requirements: (p.requirements || []).join('\n'),
  instructions: p.instructions || '',
  techStack: p.techStack || '',
  deadline: p.deadline ? p.deadline.slice(0, 10) : '',
  maxMarks: p.maxMarks || 100,
})

export default function AdminProjects() {
  const { data, loading, error, reload } = useResource(listProjectTasks, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState(null) // { id?, ...fields }
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const rows = data?.projects ?? []

  const openNew = () => { setForm(blank()); setNote(null) }
  const openEdit = (p) => setForm(toForm(p))

  // Arrived from the common "Add Content" upload with ?edit=<draftId> — open that
  // draft for review/publish. The upload itself happens on the Content page.
  const consumedEdit = useRef(false)
  useEffect(() => {
    const id = searchParams.get('edit')
    if (consumedEdit.current || !id || rows.length === 0) return
    const p = rows.find((x) => x.id === id)
    if (p) {
      consumedEdit.current = true
      setForm(toForm(p))
      setNote({ type: 'success', text: 'Project draft created from the uploaded requirement. Review the fields, then publish.' })
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, rows])

  const save = async (publish) => {
    if (!form.title.trim()) {
      setNote({ type: 'error', text: 'Title is required.' })
      return
    }
    setBusy(true)
    setNote(null)
    const payload = {
      title: form.title,
      description: form.description,
      requirements: form.requirements,
      instructions: form.instructions,
      techStack: form.techStack,
      deadline: form.deadline || null,
      maxMarks: Number(form.maxMarks) || 100,
      status: publish ? 'published' : 'draft',
    }
    try {
      if (form.id) await updateProjectTask(form.id, payload)
      else await createProjectTask(payload)
      setForm(null)
      reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const togglePublish = async (p) => {
    await setProjectTaskPublished(p.id, p.status !== 'published')
    reload()
  }
  const remove = async (id) => {
    await deleteProjectTask(id)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Project Tasks"
        subtitle="Manage project briefs. Upload new ones from the Add Content page — only published tasks appear on the student dashboard."
        actions={!form && <Button onClick={openNew}>New project task</Button>}
      />

      {form && (
        <Card
          title={form.id ? 'Review project task' : 'New project task'}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancel</Button>
              <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              <Button size="sm" onClick={() => save(true)} disabled={busy}>Save &amp; publish</Button>
            </>
          }
          style={{ marginBottom: 20 }}
        >
          <div className="grid grid--2">
            <div className="field"><label>Project Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field"><label>Technology</label>
              <input className="input" placeholder="e.g. React + Node + MongoDB" value={form.techStack} onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))} />
            </div>
            <div className="field"><label>Deadline (optional)</label>
              <input type="date" className="input" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="field"><label>Maximum Marks</label>
              <input type="number" min={1} className="input" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))} />
            </div>
          </div>
          <div className="field"><label>Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="field"><label>Requirements (one per line)</label>
            <textarea className="input" rows={4} value={form.requirements} onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>Instructions (optional)</label>
            <textarea className="input" rows={3} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </div>
          {note && <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginTop: 14 }}>{note.text}</div>}
        </Card>
      )}

      {note && !form && (
        <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginBottom: 20 }}>{note.text}</div>
      )}

      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading project tasks…">
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Tech</th><th>Requirements</th><th>Deadline</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No project tasks yet. Upload one from the Add Content page.</td></tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td className="muted">{p.techStack || '—'}</td>
                      <td className="muted">{(p.requirements || []).length}</td>
                      <td className="muted">{p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</td>
                      <td><Badge variant={statusVariant[p.status]}>{p.status}</Badge></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => togglePublish(p)}>
                          {p.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>Delete</Button>
                      </td>
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
