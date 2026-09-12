import { useRef, useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import {
  listQuestions,
  createQuestions,
  updateQuestion,
  setQuestionStatus,
  deleteQuestion,
  importQuestions,
} from '../../services/academicApi'

const KEYS = ['A', 'B', 'C', 'D']
const statusVariant = { draft: 'neutral', approved: 'warning', published: 'success' }
const blank = () => ({
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  correctAnswer: 'A',
  subject: '',
  unit: '',
  topic: '',
  difficulty: 'Medium',
  marks: 1,
  explanation: '',
})

function QuestionEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="q-block">
      <div className="grid grid--3">
        <div className="field"><label>Subject</label><input className="input" value={value.subject} onChange={(e) => set({ subject: e.target.value })} /></div>
        <div className="field"><label>Unit</label><input className="input" value={value.unit} onChange={(e) => set({ unit: e.target.value })} /></div>
        <div className="field"><label>Topic</label><input className="input" value={value.topic} onChange={(e) => set({ topic: e.target.value })} /></div>
        <div className="field"><label>Difficulty</label>
          <select className="input" value={value.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <div className="field"><label>Marks</label><input type="number" min={1} className="input" value={value.marks} onChange={(e) => set({ marks: Number(e.target.value) })} /></div>
      </div>
      <div className="field"><label>Question</label>
        <textarea className="input" rows={2} value={value.question} onChange={(e) => set({ question: e.target.value })} />
      </div>
      <div className="field" style={{ marginBottom: 8 }}><label>Options — select the correct answer</label>
        {KEYS.map((k) => (
          <div className="opt-row" key={k}>
            <input type="radio" checked={value.correctAnswer === k} onChange={() => set({ correctAnswer: k })} aria-label={`${k} correct`} />
            <input className="input" value={value.options[k]} onChange={(e) => set({ options: { ...value.options, [k]: e.target.value } })} />
          </div>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 0 }}><label>Explanation (optional)</label>
        <input className="input" value={value.explanation} onChange={(e) => set({ explanation: e.target.value })} />
      </div>
    </div>
  )
}

export default function AdminQuestionBank() {
  const [filter, setFilter] = useState('')
  const { data, loading, error, reload } = useResource(
    () => listQuestions(filter ? `?status=${filter}` : ''),
    [filter],
  )
  const [adding, setAdding] = useState(null)
  const [editing, setEditing] = useState(null)
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const fileRef = useRef(null)
  const rows = data?.questions ?? []

  // "Select All" — bulk-selection helper only. It does NOT approve, publish or
  // create anything; the existing per-row action buttons are unchanged.
  const toggleOne = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const visibleIds = rows.map((q) => q.id)
  const allSelected = rows.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) visibleIds.forEach((id) => n.delete(id))
      else visibleIds.forEach((id) => n.add(id))
      return n
    })

  const saveNew = async () => {
    setBusy(true); setNote(null)
    try {
      await createQuestions([{ ...adding, status: 'approved' }])
      setAdding(null)
      setNote({ type: 'success', text: 'Question added to the bank.' })
      reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally { setBusy(false) }
  }

  const saveEdit = async () => {
    setBusy(true)
    try {
      await updateQuestion(editing.id, editing)
      setEditing(null)
      reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally { setBusy(false) }
  }

  const changeStatus = async (id, status) => { await setQuestionStatus(id, status); reload() }
  const remove = async (id) => { await deleteQuestion(id); reload() }

  const doImport = async (file) => {
    if (!file) return
    setBusy(true); setNote(null)
    try {
      const res = await importQuestions({ file })
      setNote({ type: 'success', text: `Imported ${res.created} question(s).` })
      reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <PageHeader
        title="Question Bank"
        subtitle="All MCQs. Add manually, import from a file, edit, approve and publish."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".txt,.docx,.xlsx,.xls,.csv" hidden onChange={(e) => doImport(e.target.files?.[0])} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Import file</Button>
            <Button onClick={() => setAdding(blank())}>Add question</Button>
          </>
        }
      />

      {note && (
        <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginBottom: 16 }}>{note.text}</div>
      )}

      {adding && (
        <Card
          title="New question"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>Cancel</Button>
              <Button size="sm" onClick={saveNew} disabled={busy}>Save</Button>
            </>
          }
          style={{ marginBottom: 20 }}
        >
          <QuestionEditor value={adding} onChange={setAdding} />
        </Card>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {['', 'draft', 'approved', 'published'].map((s) => (
          <button
            key={s || 'all'}
            className={`role-option ${filter === s ? 'is-active' : ''}`.trim()}
            style={{ padding: '6px 12px' }}
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading questions…">
        {editing && (
          <Card
            title="Edit question"
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={saveEdit} disabled={busy}>Save</Button>
              </>
            }
            style={{ marginBottom: 20 }}
          >
            <QuestionEditor value={editing} onChange={setEditing} />
          </Card>
        )}

        <Card
          flush
          title={selected.size > 0 ? `Questions — ${selected.size} selected` : 'Questions'}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible questions"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={toggleAll}
                      disabled={rows.length === 0}
                    />
                  </th>
                  <th>Question</th><th>Topic</th><th>Difficulty</th><th>Ans</th><th>Marks</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="muted">No questions yet. Add one or use the Question Generator.</td></tr>
                ) : (
                  rows.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Select question"
                          checked={selected.has(q.id)}
                          onChange={() => toggleOne(q.id)}
                        />
                      </td>
                      <td style={{ maxWidth: 380 }}>{q.question}</td>
                      <td className="muted">{q.topic || '—'}</td>
                      <td>{q.difficulty}</td>
                      <td>{q.correctAnswer}</td>
                      <td>{q.marks}</td>
                      <td><Badge variant={statusVariant[q.status]}>{q.status}</Badge></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(q)}>Edit</Button>
                        {q.status === 'draft' && <Button variant="ghost" size="sm" onClick={() => changeStatus(q.id, 'approved')}>Approve</Button>}
                        {q.status === 'approved' && <Button variant="ghost" size="sm" onClick={() => changeStatus(q.id, 'published')}>Publish</Button>}
                        {q.status === 'published' && <Button variant="ghost" size="sm" onClick={() => changeStatus(q.id, 'approved')}>Unpublish</Button>}
                        <Button variant="ghost" size="sm" onClick={() => remove(q.id)}>Delete</Button>
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
