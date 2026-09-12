import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card, { StatCard } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import FileTree from '../../components/ui/FileTree'
import { BarChart } from '../../components/ui/Charts'
import { useResource } from '../../hooks/useResource'
import { evaluatorProject, submitEvaluation, downloadSubmissionZip } from '../../services/evaluationApi'

const DETECT_LABELS = {
  reactFrontend: 'React frontend',
  nodeBackend: 'Node/Express backend',
  packageJson: 'package.json',
  apiRoutes: 'API routes',
  database: 'Database configuration',
  readme: 'README',
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export default function EvaluateProject() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useResource(
    () => evaluatorProject(submissionId),
    [submissionId],
  )

  return (
    <>
      <PageHeader title="Evaluate Project" subtitle={data?.project?.projectName} />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading project analysis…">
        {data && <EvaluateBody data={data} submissionId={submissionId} navigate={navigate} />}
      </AsyncBlock>
    </>
  )
}

function EvaluateBody({ data, submissionId, navigate }) {
  const { project, aiSuggested: ai, existingEvaluation } = data
  const analysis = project.analysis

  const [scores, setScores] = useState(() => {
    const src = existingEvaluation?.rubricScores?.length
      ? existingEvaluation.rubricScores
      : ai.criteria
    return Object.fromEntries(src.map((c) => [c.key, c.score]))
  })
  const [comments, setComments] = useState(existingEvaluation?.evaluatorComments || '')
  const [strengths, setStrengths] = useState(
    (existingEvaluation?.strengths?.length ? existingEvaluation.strengths : ai.strengths).join('\n'),
  )
  const [weaknesses, setWeaknesses] = useState(
    (existingEvaluation?.weaknesses?.length ? existingEvaluation.weaknesses : ai.weaknesses).join('\n'),
  )
  const [finalFeedback, setFinalFeedback] = useState(existingEvaluation?.finalFeedback || '')
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const downloadZip = async () => {
    setDownloading(true)
    try {
      await downloadSubmissionZip(submissionId, project.fileName)
    } catch (err) {
      setNote({ type: 'error', text: err.message || 'Could not download the file.' })
    } finally {
      setDownloading(false)
    }
  }

  const finalTotal = useMemo(
    () =>
      ai.criteria.reduce(
        (sum, c) => sum + clamp(Number(scores[c.key]) || 0, 0, c.max),
        0,
      ),
    [scores, ai.criteria],
  )

  if (!analysis) {
    return (
      <Card>
        <EmptyState title="No analysis available" message="This submission has no stored project analysis." />
      </Card>
    )
  }

  const acceptAi = () => {
    setScores(Object.fromEntries(ai.criteria.map((c) => [c.key, c.score])))
    setNote({ type: 'success', text: 'AI suggested scores applied. Adjust any value before submitting.' })
  }

  const submit = async () => {
    setBusy(true)
    setNote(null)
    try {
      await submitEvaluation({
        projectSubmissionId: submissionId,
        rubricScores: ai.criteria.map((c) => ({
          key: c.key,
          score: clamp(Number(scores[c.key]) || 0, 0, c.max),
        })),
        evaluatorComments: comments,
        strengths,
        weaknesses,
        finalFeedback,
      })
      navigate('/evaluator/completed')
    } catch (err) {
      setNote({ type: 'error', text: err.message || 'Could not submit evaluation.' })
      setBusy(false)
    }
  }

  const d = analysis.detected || {}

  return (
    <>
      {existingEvaluation && (
        <div className="note" style={{ marginBottom: 20 }}>
          This project already has an evaluation ({existingEvaluation.totalScore}/100). Submitting again updates it.
        </div>
      )}

      <div className="grid grid--2" style={{ marginBottom: 20 }}>
        <Card title="Student information">
          <ul className="list-plain kv">
            <li><span className="muted">Name</span><span>{project.studentName}</span></li>
            <li><span className="muted">Email</span><span>{project.studentEmail}</span></li>
            <li><span className="muted">Submitted</span><span>{new Date(project.submittedAt).toLocaleString()}</span></li>
            <li><span className="muted">File</span><span>{project.fileName}</span></li>
            <li><span className="muted">Size</span><span>{(project.fileSize / 1024).toFixed(0)} KB</span></li>
          </ul>
        </Card>
        <Card
          title="Project information"
          actions={
            <Button variant="secondary" size="sm" onClick={downloadZip} disabled={downloading}>
              {downloading ? 'Downloading…' : 'Download ZIP'}
            </Button>
          }
        >
          <ul className="list-plain kv">
            <li><span className="muted">Task</span><span>{project.projectTask || project.projectName}</span></li>
            <li><span className="muted">Technology</span><span>{project.technology || '—'}</span></li>
            {project.brief?.deadline && <li><span className="muted">Deadline</span><span>{new Date(project.brief.deadline).toLocaleDateString()}</span></li>}
            {project.brief?.maxMarks && <li><span className="muted">Maximum marks</span><span>{project.brief.maxMarks}</span></li>}
          </ul>
          {project.description && <p className="muted" style={{ marginTop: 10 }}>{project.description}</p>}
        </Card>
      </div>

      {project.brief && (project.brief.requirements?.length > 0 || project.brief.instructions) && (
        <Card title="Project brief" style={{ marginBottom: 20 }}>
          {project.brief.requirements?.length > 0 && (
            <>
              <div className="section-label">Requirements</div>
              <ul className="list-plain evidence" style={{ marginBottom: 10 }}>
                {project.brief.requirements.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </>
          )}
          {project.brief.instructions && (
            <>
              <div className="section-label">Instructions</div>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{project.brief.instructions}</p>
            </>
          )}
        </Card>
      )}

      <Card title="Project analysis" style={{ marginBottom: 20 }}>
        <div className="grid grid--3" style={{ marginBottom: 18 }}>
          <StatCard label="Files" value={analysis.fileCount} />
          <StatCard label="Folders" value={analysis.folderCount} />
          <StatCard label="Technologies" value={analysis.technologies.length} />
        </div>

        <div className="section-label">Detected</div>
        <ul className="list-plain check-list" style={{ marginBottom: 16 }}>
          {Object.entries(DETECT_LABELS).map(([k, label]) => (
            <li key={k} className={d[k] ? 'is-yes' : 'is-no'}>
              {d[k] ? '✓' : '✗'} {label}
            </li>
          ))}
        </ul>

        <div className="section-label">Detected technologies</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {analysis.technologies.map((t) => (
            <Badge key={t} variant="accent">{t}</Badge>
          ))}
        </div>

        {analysis.secrets?.length > 0 && (
          <div className="note note--error">
            ⚠ Sensitive value detected in {analysis.secrets.length} file(s). Values are never read or displayed.
          </div>
        )}
      </Card>

      <Card title="Project structure" style={{ marginBottom: 20 }}>
        <FileTree tree={analysis.tree} />
      </Card>

      <Card
        title="AI Suggested Evaluation"
        subtitle="Generated from the extracted project evidence. Not the final score."
        style={{ marginBottom: 20 }}
      >
        <BarChart
          unit=""
          data={ai.criteria.map((c) => ({ label: `${c.key} (/${c.max})`, value: c.score }))}
          max={Math.max(...ai.criteria.map((c) => c.max))}
        />
        <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
          <strong>Total</strong>
          <strong>{ai.total}/{ai.max}</strong>
        </div>
      </Card>

      <Card title="Why this score?" style={{ marginBottom: 20 }}>
        <div className="stack">
          {ai.criteria.map((c) => (
            <div key={c.key} className="q-block">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{c.key}</strong>
                <Badge variant="neutral">{c.score}/{c.max}</Badge>
              </div>
              <div className="section-label">Evidence</div>
              <ul className="list-plain evidence">
                {c.evidence.map((e, i) => (
                  <li key={i} className={e.ok ? 'is-yes' : 'is-no'}>
                    {e.ok ? '✓' : '⚠'} {e.text}
                  </li>
                ))}
              </ul>
              {c.reason && <p className="muted" style={{ marginTop: 8 }}><strong>Reason:</strong> {c.reason}</p>}
              {c.recommendation && (
                <p className="muted" style={{ marginTop: 4 }}><strong>Recommendation:</strong> {c.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid--2" style={{ marginBottom: 20 }}>
        <Card title="Strengths">
          <ul className="list-plain evidence">
            {ai.strengths.length ? ai.strengths.map((t, i) => <li key={i} className="is-yes">✓ {t}</li>) : <li className="muted">—</li>}
          </ul>
        </Card>
        <Card title="Weaknesses">
          <ul className="list-plain evidence">
            {ai.weaknesses.length ? ai.weaknesses.map((t, i) => <li key={i} className="is-no">⚠ {t}</li>) : <li className="muted">—</li>}
          </ul>
        </Card>
      </div>

      <Card title="Recommendations" style={{ marginBottom: 20 }}>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          {ai.recommendations.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </Card>

      <Card
        title="Evaluator score"
        subtitle="AI is a suggestion. Accept it or adjust each rubric value, then submit."
        actions={<Button variant="secondary" size="sm" onClick={acceptAi}>Accept AI Score</Button>}
      >
        {note && (
          <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginBottom: 16 }}>
            {note.text}
          </div>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Criterion</th><th>AI</th><th style={{ width: 130 }}>Final</th><th style={{ width: 60 }}>Max</th></tr>
            </thead>
            <tbody>
              {ai.criteria.map((c) => (
                <tr key={c.key}>
                  <td>{c.key}</td>
                  <td className="muted">{c.score}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={c.max}
                      className="input"
                      style={{ width: 90 }}
                      value={scores[c.key] ?? ''}
                      onChange={(e) => setScores((s) => ({ ...s, [c.key]: e.target.value }))}
                    />
                  </td>
                  <td className="muted">{c.max}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>Final total</td>
                <td className="muted">{ai.total}</td>
                <td style={{ fontWeight: 600 }} colSpan={2}>
                  <span style={{ color: finalTotal > 100 ? 'var(--danger)' : undefined }}>{finalTotal}</span>/100
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid--2" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="strengths">Strengths (one per line)</label>
            <textarea id="strengths" className="input" rows={4} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="weaknesses">Areas for improvement (one per line)</label>
            <textarea id="weaknesses" className="input" rows={4} value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="comments">Comments</label>
          <textarea
            id="comments"
            className="input"
            rows={3}
            placeholder="Notes for the record…"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="finalFeedback">Final feedback (shown to the student)</label>
          <textarea
            id="finalFeedback"
            className="input"
            rows={4}
            placeholder="Overall assessment and next steps for the student…"
            value={finalFeedback}
            onChange={(e) => setFinalFeedback(e.target.value)}
          />
        </div>

        <Button onClick={submit} disabled={busy || finalTotal > 100}>
          {busy ? 'Submitting…' : 'Submit Final Evaluation'}
        </Button>
      </Card>
    </>
  )
}
