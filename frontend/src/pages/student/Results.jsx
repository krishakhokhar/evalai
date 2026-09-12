import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card, { StatCard } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { DonutStat, Donut, BarChart, ColumnChart } from '../../components/ui/Charts'
import { useResource } from '../../hooks/useResource'
import { myMcqResults, mcqResult } from '../../services/academicApi'
import { myResults as projectResults } from '../../services/projectApi'

function grade(pct) {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}

export default function StudentResults() {
  const mcq = useResource(myMcqResults, [])
  const project = useResource(projectResults, [])
  const results = mcq.data?.results ?? []

  return (
    <>
      <PageHeader title="Results" subtitle="Your assessment scores, analytics and project evaluation." />

      <AsyncBlock loading={mcq.loading} error={mcq.error} onRetry={mcq.reload} loadingText="Loading assessment results…">
        {results.length > 0 && <Analytics results={results} />}
        <div className="section-label" style={{ marginTop: 4 }}>Assessment results</div>
        <McqResults results={results} />
      </AsyncBlock>

      <div className="section-label" style={{ marginTop: 24 }}>Project evaluation</div>
      <AsyncBlock loading={project.loading} error={project.error} onRetry={project.reload} loadingText="Loading project evaluation…">
        {project.data && <ProjectEval data={project.data} />}
      </AsyncBlock>
    </>
  )
}

function Analytics({ results }) {
  const latest = results[0]
  const totalCorrect = results.reduce((s, r) => s + r.correctCount, 0)
  const totalWrong = results.reduce((s, r) => s + r.incorrectCount, 0)

  const bySubject = {}
  results.forEach((r) => {
    const s = r.subject || 'General'
    bySubject[s] = bySubject[s] || { sum: 0, n: 0 }
    bySubject[s].sum += r.percentage
    bySubject[s].n += 1
  })
  const subjectData = Object.entries(bySubject).map(([label, v]) => ({ label, value: Math.round(v.sum / v.n) }))
  const history = [...results].reverse().map((r, i) => ({ label: `#${i + 1}`, value: r.percentage }))

  return (
    <Card title="Performance overview" style={{ marginBottom: 20 }}>
      <div className="grid grid--2" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 20, alignItems: 'center' }}>
          <DonutStat value={latest.percentage} label="Latest score" sublabel={`Grade ${grade(latest.percentage)}`} />
          <div className="stack" style={{ gap: 6 }}>
            <div><strong>{results.length}</strong> assessment{results.length > 1 ? 's' : ''} completed</div>
            <div className="muted">Avg {Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)}%</div>
          </div>
        </div>
        <div>
          <div className="section-label">Correct vs incorrect (all attempts)</div>
          <Donut
            segments={[
              { label: 'Correct', value: totalCorrect, color: 'var(--success)' },
              { label: 'Incorrect', value: totalWrong, color: 'var(--danger)' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        <div>
          <div className="section-label">Subject-wise performance</div>
          <BarChart data={subjectData} />
        </div>
        <div>
          <div className="section-label">Assessment history</div>
          <ColumnChart data={history} />
        </div>
      </div>
    </Card>
  )
}

function McqResults({ results }) {
  const [open, setOpen] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  if (results.length === 0) {
    return (
      <Card>
        <EmptyState title="No assessments completed yet" message="Take a published assessment to see your score here." />
      </Card>
    )
  }

  const toggle = async (r) => {
    if (open === r.attemptId) return setOpen(null)
    setOpen(r.attemptId)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const res = await mcqResult(r.attemptId)
      setDetail(res.result)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="stack">
      {results.map((r) => {
        const passed = r.score >= (r.passingMarks || 0)
        return (
          <Card
            key={r.attemptId}
            title={r.assessmentTitle}
            subtitle={`${r.subject || 'General'} · ${new Date(r.submittedAt).toLocaleString()}`}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <Badge variant={passed ? 'success' : 'danger'}>{passed ? 'Pass' : 'Fail'}</Badge>
                <Badge variant="neutral">Grade {grade(r.percentage)}</Badge>
                <Badge variant={r.percentage >= 60 ? 'success' : 'warning'}>{r.score}/{r.totalMarks} · {r.percentage}%</Badge>
              </div>
            }
          >
            <div className="grid grid--3" style={{ marginBottom: 14 }}>
              <StatCard label="Obtained / Total" value={`${r.score} / ${r.totalMarks}`} hint={`Passing ${r.passingMarks || 0}`} />
              <StatCard label="Correct answers" value={r.correctCount} />
              <StatCard label="Wrong answers" value={r.incorrectCount} />
            </div>

            <div className="grid grid--2" style={{ marginBottom: 14 }}>
              <div>
                <div className="section-label">Correct vs wrong</div>
                <Donut
                  size={120}
                  segments={[
                    { label: 'Correct', value: r.correctCount, color: 'var(--success)' },
                    { label: 'Wrong', value: r.incorrectCount, color: 'var(--danger)' },
                  ]}
                />
              </div>
              <div>
                <div className="section-label">Topic-wise (%)</div>
                <BarChart data={r.topicBreakdown.map((t) => ({ label: t.topic, value: t.percent }))} />
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={() => toggle(r)}>
              {open === r.attemptId ? 'Hide answer review' : 'Review answers'}
            </Button>

            {open === r.attemptId && (
              <div style={{ marginTop: 14 }}>
                {loadingDetail && <p className="muted">Loading…</p>}
                {detail && (
                  <div className="stack" style={{ gap: 10 }}>
                    {detail.review.map((q) => (
                      <div key={q.questionId} className="q-block">
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.number}. {q.question}</div>
                        <ul className="list-plain evidence">
                          {q.options.map((o) => {
                            const isCorrect = o.key === q.correctKey
                            const isChosen = o.key === q.chosenKey
                            return (
                              <li key={o.key} className={isCorrect ? 'is-yes' : isChosen ? 'is-no' : ''}>
                                {isCorrect ? '✓' : isChosen ? '✗' : '•'} {o.key}. {o.text}
                                {isChosen && !isCorrect ? '  (your answer)' : ''}
                              </li>
                            )
                          })}
                        </ul>
                        {q.explanation && <p className="muted" style={{ marginTop: 6 }}>{q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function ProjectEval({ data }) {
  const { hasProject, project, evaluation } = data
  if (!hasProject) {
    return (
      <Card>
        <EmptyState
          title="No project submitted yet"
          message="Submit your project ZIP for the assigned task to receive an evaluation."
          action={<Button to="/student/project-submission">Go to Project Submission</Button>}
        />
      </Card>
    )
  }
  if (!evaluation) {
    return (
      <Card>
        <EmptyState
          title="Evaluation pending"
          message={`"${project.projectTitle || project.projectName}" was submitted on ${new Date(project.submittedAt).toLocaleDateString()}. Your score and feedback will appear here once an evaluator completes the review.`}
        />
      </Card>
    )
  }
  const max = evaluation.max || 100
  const pct = evaluation.percentage ?? Math.round((evaluation.totalScore / max) * 100)
  return (
    <div className="stack">
      <Card>
        <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <DonutStat value={evaluation.totalScore} max={max} label="Project score" sublabel={`${evaluation.totalScore}/${max}`} />
          <div className="grid grid--3" style={{ flex: 1, minWidth: 260 }}>
            <StatCard label="Percentage" value={`${pct}%`} />
            <StatCard label="Grade" value={grade(pct)} />
            {evaluation.aiSuggestedTotal != null && <StatCard label="AI suggested" value={`${evaluation.aiSuggestedTotal}/${max}`} />}
          </div>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {project.projectTitle || project.projectName} · evaluated by {evaluation.evaluatorName} · {new Date(evaluation.updatedAt).toLocaleDateString()}
        </div>
      </Card>

      <Card title="Criteria-wise marks">
        <BarChart
          unit=""
          data={evaluation.rubricScores.map((c) => ({ label: c.key, value: c.score }))}
          max={Math.max(...evaluation.rubricScores.map((c) => c.max))}
        />
        <div className="section-label" style={{ marginTop: 12 }}>As a percentage of each criterion's maximum</div>
        <BarChart data={evaluation.rubricScores.map((c) => ({ label: c.key, value: Math.round((c.score / c.max) * 100) }))} />
      </Card>

      <Card title="Why this score?">
        <div className="stack">
          {evaluation.rubricScores.map((c) => (
            <div key={c.key} className="q-block">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{c.key}</strong><Badge variant="neutral">{c.score}/{c.max}</Badge>
              </div>
              <ul className="list-plain evidence">
                {(c.evidence || []).map((e, i) => (
                  <li key={i} className={e.ok ? 'is-yes' : 'is-no'}>{e.ok ? '✓' : '⚠'} {e.text}</li>
                ))}
              </ul>
              {c.reason && <p className="muted" style={{ marginTop: 8 }}><strong>Reason:</strong> {c.reason}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid--2">
        <Card title="Strengths">
          <ul className="list-plain evidence">
            {evaluation.strengths.length ? evaluation.strengths.map((t, i) => <li key={i} className="is-yes">✓ {t}</li>) : <li className="muted">—</li>}
          </ul>
        </Card>
        <Card title="Areas for improvement">
          <ul className="list-plain evidence">
            {evaluation.weaknesses.length ? evaluation.weaknesses.map((t, i) => <li key={i} className="is-no">⚠ {t}</li>) : <li className="muted">—</li>}
          </ul>
        </Card>
      </div>

      {evaluation.recommendations?.length > 0 && (
        <Card title="Recommendations">
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            {evaluation.recommendations.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </Card>
      )}

      {evaluation.finalFeedback && (
        <Card title="Evaluator feedback"><p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{evaluation.finalFeedback}</p></Card>
      )}
    </div>
  )
}
