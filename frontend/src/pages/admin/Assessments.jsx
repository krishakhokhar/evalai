import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import EmptyState from '../../components/ui/EmptyState'
import { useResource } from '../../hooks/useResource'
import {
  listAssessments,
  listQuestions,
  listSyllabi,
  createAssessment,
  updateAssessment,
} from '../../services/academicApi'

const statusVariant = { draft: 'neutral', published: 'success', closed: 'warning' }

export default function AdminAssessments() {
  const assessments = useResource(listAssessments, [])
  const bank = useResource(() => listQuestions('?status=approved'), [])
  const syllabi = useResource(listSyllabi, [])

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    syllabusId: '',
    durationMinutes: 20,
    marksPerQuestion: 1,
    passingMarks: 0,
    difficulty: 'Mixed',
    status: 'draft',
  })
  const [picked, setPicked] = useState(new Set())
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const approved = bank.data?.questions ?? []
  const rows = assessments.data?.assessments ?? []

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const allSelected = approved.length > 0 && approved.every((q) => picked.has(q.id))
  const someSelected = approved.some((q) => picked.has(q.id)) && !allSelected
  const toggleAll = () =>
    setPicked(allSelected ? new Set() : new Set(approved.map((q) => q.id)))

  const create = async () => {
    if (!form.title.trim() || picked.size === 0) {
      setNote({ type: 'error', text: 'Add a title and select at least one question.' })
      return
    }
    setBusy(true)
    setNote(null)
    try {
      await createAssessment({ ...form, questionIds: [...picked] })
      setOpen(false)
      setForm({ title: '', description: '', syllabusId: '', durationMinutes: 20, marksPerQuestion: 1, passingMarks: 0, difficulty: 'Mixed', status: 'draft' })
      setPicked(new Set())
      assessments.reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (id, status) => {
    await updateAssessment(id, { status })
    assessments.reload()
  }

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Build an assessment from approved questions, then publish it for students."
        actions={
          !open && (
            <Button onClick={() => setOpen(true)} disabled={approved.length === 0}>
              New assessment
            </Button>
          )
        }
      />

      {open && (
        <Card
          title="New assessment"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
            </>
          }
          style={{ marginBottom: 20 }}
        >
          <div className="grid grid--3">
            <div className="field"><label>Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field"><label>Syllabus (optional)</label>
              <select className="input" value={form.syllabusId} onChange={(e) => setForm((f) => ({ ...f, syllabusId: e.target.value }))}>
                <option value="">—</option>
                {(syllabi.data?.syllabi ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="field"><label>Difficulty</label>
              <select className="input" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                <option>Easy</option><option>Medium</option><option>Hard</option><option>Mixed</option>
              </select>
            </div>
            <div className="field"><label>Duration (minutes)</label>
              <input type="number" min={1} className="input" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
            </div>
            <div className="field"><label>Marks per question</label>
              <input type="number" min={1} className="input" value={form.marksPerQuestion} onChange={(e) => setForm((f) => ({ ...f, marksPerQuestion: Number(e.target.value) }))} />
            </div>
            <div className="field"><label>Passing marks</label>
              <input type="number" min={0} className="input" value={form.passingMarks} onChange={(e) => setForm((f) => ({ ...f, passingMarks: Number(e.target.value) }))} />
            </div>
            <div className="field"><label>Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Description (optional)</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="section-label">Select questions ({picked.size} of {approved.length} selected)</div>
          <div className="tree" style={{ maxHeight: 300 }}>
            {approved.length > 0 && (
              <label
                className="tree__row"
                style={{ cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                />
                <span>Select all</span>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>{picked.size}/{approved.length}</span>
              </label>
            )}
            {approved.map((q) => (
              <label key={q.id} className="tree__row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(q.id)} onChange={() => toggle(q.id)} />
                <span>{q.question}</span>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>{q.topic || q.subject} · {q.difficulty}</span>
              </label>
            ))}
          </div>
          {note && <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginTop: 14 }}>{note.text}</div>}
        </Card>
      )}

      {!open && approved.length === 0 && (
        <Card style={{ marginBottom: 20 }}>
          <EmptyState
            title="No approved questions"
            message="Approve questions in the Question Bank (or generate them) before building an assessment."
            action={<Button to="/admin/questions">Go to Question Bank</Button>}
          />
        </Card>
      )}

      <AsyncBlock loading={assessments.loading} error={assessments.error} onRetry={assessments.reload} loadingText="Loading assessments…">
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Subject</th><th>Questions</th><th>Total marks</th><th>Duration</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="muted">No assessments yet.</td></tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td className="muted">{a.subject || '—'}</td>
                      <td>{a.numQuestions}</td>
                      <td>{a.totalMarks}</td>
                      <td className="muted">{a.durationMinutes} min</td>
                      <td><Badge variant={statusVariant[a.status]}>{a.status}</Badge></td>
                      <td style={{ textAlign: 'right' }}>
                        {a.status === 'draft' && <Button variant="ghost" size="sm" onClick={() => setStatus(a.id, 'published')}>Publish</Button>}
                        {a.status === 'published' && <Button variant="ghost" size="sm" onClick={() => setStatus(a.id, 'closed')}>Close</Button>}
                        {a.status === 'closed' && <Button variant="ghost" size="sm" onClick={() => setStatus(a.id, 'published')}>Reopen</Button>}
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
