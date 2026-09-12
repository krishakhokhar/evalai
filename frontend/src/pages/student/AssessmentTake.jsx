import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { startAssessment, submitAssessment } from '../../services/academicApi'

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function AssessmentTake() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useResource(() => startAssessment(id), [id])
  const attempt = data?.attempt

  return (
    <>
      <PageHeader title="Assessment" />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Preparing your paper…">
        {attempt && (
          attempt.status === 'submitted'
            ? <AlreadyDone navigate={navigate} />
            : <Exam id={id} attempt={attempt} navigate={navigate} />
        )}
      </AsyncBlock>
    </>
  )
}

function AlreadyDone({ navigate }) {
  return (
    <Card>
      <div className="empty">
        <div className="empty__title">You have already submitted this assessment</div>
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/student/results')}>View result</Button>
        </div>
      </div>
    </Card>
  )
}

function Exam({ id, attempt, navigate }) {
  const storeKey = `evalai.exam.${attempt.id}`
  const questions = attempt.questions
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null')
      if (saved) return saved
    } catch { /* ignore */ }
    return attempt.answers || {}
  })
  const [current, setCurrent] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const deadline = useMemo(
    () => new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60_000,
    [attempt],
  )
  const [remaining, setRemaining] = useState(attempt.durationMinutes * 60)

  useEffect(() => {
    try { sessionStorage.setItem(storeKey, JSON.stringify(answers)) } catch { /* ignore */ }
  }, [answers, storeKey])

  const submit = useCallback(
    async (auto = false) => {
      setBusy(true)
      setErr('')
      try {
        await submitAssessment(id, answers)
        try { sessionStorage.removeItem(storeKey) } catch { /* ignore */ }
        navigate('/student/results', { state: { justSubmitted: true, auto } })
      } catch (e) {
        setErr(e.message || 'Could not submit.')
        setBusy(false)
      }
    },
    [answers, id, navigate, storeKey],
  )

  const submittedRef = useRef(false)
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true
        submit(true)
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadline, submit])

  useEffect(() => {
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const q = questions[current]
  const answeredCount = Object.keys(answers).length
  const choose = (key) => setAnswers((a) => ({ ...a, [q.questionId]: key }))

  return (
    <div className="exam-layout">
      <div className="stack">
        <Card>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Badge variant="neutral">Question {current + 1} of {questions.length}</Badge>
            <Badge variant={remaining < 60 ? 'danger' : 'accent'}>⏱ {fmt(remaining)}</Badge>
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>{q.question}</div>
          <div className="stack" style={{ gap: 8 }}>
            {q.options.map((o) => (
              <label key={o.key} className="opt-choice">
                <input
                  type="radio"
                  name={q.questionId}
                  checked={answers[q.questionId] === o.key}
                  onChange={() => choose(o.key)}
                />
                <span><strong>{o.key}.</strong> {o.text}</span>
              </label>
            ))}
          </div>
          {err && <div className="note note--error" style={{ marginTop: 14 }}>{err}</div>}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
            <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
              Previous
            </Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
            ) : (
              <Button onClick={() => submit(false)} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit assessment'}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Question navigator">
        <ProgressBar label={`${answeredCount}/${questions.length} answered`} value={(answeredCount / questions.length) * 100} showValue={false} />
        <div className="qnav">
          {questions.map((qq, i) => {
            const state = answers[qq.questionId] ? 'done' : 'todo'
            return (
              <button
                key={qq.questionId}
                className={`qnav__cell ${state} ${i === current ? 'is-current' : ''}`.trim()}
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <Button block style={{ marginTop: 14 }} onClick={() => submit(false)} disabled={busy}>
          Submit assessment
        </Button>
      </Card>
    </div>
  )
}
