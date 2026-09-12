import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import EmptyState from '../../components/ui/EmptyState'
import { useResource } from '../../hooks/useResource'
import { listSyllabi, getSyllabus, generateQuestions, createQuestions } from '../../services/academicApi'

const KEYS = ['A', 'B', 'C', 'D']

export default function AdminQuestionGenerator() {
  const { data, loading, error, reload } = useResource(listSyllabi, [])
  const syllabi = data?.syllabi ?? []
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    syllabusId: '',
    unit: 'all',
    topic: 'all',
    count: 5,
    difficulty: 'Mixed',
  })
  const [units, setUnits] = useState([])
  const [draft, setDraft] = useState([])
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const topics = useMemo(() => {
    if (form.unit === 'all') return units.flatMap((u) => u.topics)
    return units.find((u) => u.name === form.unit)?.topics ?? []
  }, [units, form.unit])

  const pickSyllabus = async (id) => {
    setForm((f) => ({ ...f, syllabusId: id, unit: 'all', topic: 'all' }))
    setUnits([])
    if (!id) return
    try {
      const res = await getSyllabus(id)
      setUnits(res.syllabus.units || [])
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    }
  }

  // Preselect the syllabus if the admin arrived from "Generate questions".
  const preselected = useRef(false)
  useEffect(() => {
    const id = searchParams.get('syllabus')
    if (preselected.current || !id || syllabi.length === 0) return
    if (syllabi.some((s) => s.id === id)) {
      preselected.current = true
      pickSyllabus(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, syllabi])

  const generate = async () => {
    if (!form.syllabusId) {
      setNote({ type: 'error', text: 'Select a syllabus first.' })
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const res = await generateQuestions({ ...form, persist: false })
      setDraft(res.questions.map((q, i) => ({ ...q, _id: `d${Date.now()}_${i}` })))
      setNote({ type: 'success', text: `Generated ${res.questions.length} question(s) from the syllabus. Review, edit and approve.` })
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const patch = (id, p) => setDraft((d) => d.map((q) => (q._id === id ? { ...q, ...p } : q)))
  const patchOpt = (id, k, v) =>
    setDraft((d) => d.map((q) => (q._id === id ? { ...q, options: { ...q.options, [k]: v } } : q)))
  const removeQ = (id) => setDraft((d) => d.filter((q) => q._id !== id))

  const approveAll = async () => {
    if (draft.length === 0) return
    setBusy(true)
    setNote(null)
    try {
      const payload = draft.map(({ _id, ...q }) => ({ ...q, status: 'approved' }))
      const res = await createQuestions(payload)
      setDraft([])
      setNote({ type: 'success', text: `Approved & saved ${res.created} question(s) to the Question Bank.` })
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Question Generator"
        subtitle="Generate MCQs from a stored syllabus. Questions are drafted for review — only approved questions reach the Question Bank."
        actions={
          draft.length > 0 && (
            <Button onClick={approveAll} disabled={busy}>
              Approve &amp; save {draft.length}
            </Button>
          )
        }
      />

      <AsyncBlock loading={loading} error={error} onRetry={reload}>
        {syllabi.length === 0 ? (
          <Card>
            <EmptyState
              title="No syllabus yet"
              message="Upload a syllabus from Add Content first — the generator builds questions from its units and topics."
              action={<Button to="/admin/syllabus">Go to Add Content</Button>}
            />
          </Card>
        ) : (
          <Card title="Generation settings" style={{ marginBottom: 20 }}>
            <div className="grid grid--3">
              <div className="field">
                <label>Syllabus</label>
                <select className="input" value={form.syllabusId} onChange={(e) => pickSyllabus(e.target.value)}>
                  <option value="">Select…</option>
                  {syllabi.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.subject}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Unit</label>
                <select
                  className="input"
                  value={form.unit}
                  disabled={!units.length}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value, topic: 'all' }))}
                >
                  <option value="all">All units</option>
                  {units.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Topic</label>
                <select
                  className="input"
                  value={form.topic}
                  disabled={!topics.length}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                >
                  <option value="all">All topics</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Number of questions</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input"
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Difficulty</label>
                <select
                  className="input"
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Mixed</option>
                </select>
              </div>
            </div>
            <Button onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate Questions'}
            </Button>
          </Card>
        )}
      </AsyncBlock>

      {note && (
        <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginBottom: 20 }}>
          {note.text}
        </div>
      )}

      {draft.length > 0 && (
        <Card
          title="Review generated questions"
          subtitle={`${draft.length} draft question(s)`}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={generate} disabled={busy}>
                Regenerate
              </Button>
              <Button size="sm" onClick={approveAll} disabled={busy}>
                Approve &amp; save
              </Button>
            </>
          }
        >
          <div className="stack">
            {draft.map((q, qi) => (
              <div key={q._id} className="q-block">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Badge variant="neutral">Q{qi + 1}</Badge>
                    <Badge variant="neutral">{q.topic}</Badge>
                    <Badge variant="accent">{q.difficulty}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeQ(q._id)}>
                    Delete
                  </Button>
                </div>
                <div className="field">
                  <label>Question</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={q.question}
                    onChange={(e) => patch(q._id, { question: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Options — select the correct answer</label>
                  {KEYS.map((k) => (
                    <div className="opt-row" key={k}>
                      <input
                        type="radio"
                        name={`c-${q._id}`}
                        checked={q.correctAnswer === k}
                        onChange={() => patch(q._id, { correctAnswer: k })}
                        aria-label={`Mark ${k} correct`}
                      />
                      <input
                        type="text"
                        className="input"
                        value={q.options[k]}
                        onChange={(e) => patchOpt(q._id, k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
