import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import DocUpload from '../../components/ui/DocUpload'
import { useResource } from '../../hooks/useResource'
import {
  listSyllabi,
  getSyllabus,
  uploadSyllabus,
  deleteSyllabus,
  uploadProjectBrief,
} from '../../services/academicApi'

// ONE common upload workflow for Admin.
//   Content Type = Syllabus / Learning Content  -> extract units/topics, save, "Generate Questions"
//   Content Type = Project Requirement          -> extract brief, create draft, "Review & Publish"
// The upload box is shared; only the processing differs.
export default function AdminContent() {
  const { data, loading, error, reload } = useResource(listSyllabi, [])
  const navigate = useNavigate()

  const [kind, setKind] = useState('syllabus') // 'syllabus' | 'project'
  const [staged, setStaged] = useState(null) // the File chosen but not yet processed
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null) // { kind, syllabus? , project? , note }

  const [open, setOpen] = useState(null) // syllabus id whose units are expanded
  const [detail, setDetail] = useState(null)

  const list = data?.syllabi ?? []

  const chooseKind = (k) => {
    setKind(k)
    setResult(null)
    setErr(null)
  }

  const stage = (file) => {
    setStaged(file)
    setResult(null)
    setErr(null)
  }

  const process = async () => {
    if (!staged) return
    setBusy(true)
    setErr(null)
    setResult(null)
    try {
      if (kind === 'syllabus') {
        const res = await uploadSyllabus({ file: staged })
        setResult({ kind: 'syllabus', syllabus: res.syllabus, note: res.extractionNote })
        reload()
      } else {
        const res = await uploadProjectBrief({ file: staged })
        setResult({ kind: 'project', project: res.project, note: res.extractionNote })
      }
      setStaged(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleUnits = async (id) => {
    if (open === id) {
      setOpen(null)
      return
    }
    setOpen(id)
    setDetail(null)
    try {
      const res = await getSyllabus(id)
      setDetail(res.syllabus)
    } catch {
      /* ignore */
    }
  }

  const remove = async (id) => {
    await deleteSyllabus(id)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Add Content"
        subtitle="Upload a syllabus or a project requirement. Same upload box — EvalAI processes each one differently. Admin-only; students never see raw files."
      />

      <Card title="Add Content" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Content Type</label>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="content-type"
                checked={kind === 'syllabus'}
                onChange={() => chooseKind('syllabus')}
              />
              Syllabus / Learning Content
            </label>
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="content-type"
                checked={kind === 'project'}
                onChange={() => chooseKind('project')}
              />
              Project Requirements
            </label>
          </div>
        </div>

        <DocUpload
          onFile={stage}
          busy={busy}
          label={staged ? staged.name : 'Click to browse or drag & drop file here'}
          busyLabel="Processing…"
        />
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 14px' }}>
          Supported: PDF, DOC, DOCX, TXT, XLS, XLSX, CSV
        </p>

        <Button onClick={process} disabled={!staged || busy}>
          {busy ? 'Processing…' : 'Upload & Process'}
        </Button>

        {err && (
          <div className="note note--error" style={{ marginTop: 14 }}>
            {err}
          </div>
        )}

        {result?.kind === 'syllabus' && result.syllabus.unitCount > 0 && (
          <div className="note" style={{ marginTop: 14 }}>
            <div>✓ Syllabus uploaded successfully</div>
            <div>✓ Content extracted successfully</div>
            <div>
              ✓ {result.syllabus.unitCount} unit(s) / {result.syllabus.topicCount} topic(s) detected
            </div>
            <div style={{ marginTop: 12 }}>
              <Button
                size="sm"
                onClick={() => navigate(`/admin/question-generator?syllabus=${result.syllabus.id}`)}
              >
                Generate Questions
              </Button>
            </div>
          </div>
        )}

        {result?.kind === 'syllabus' && result.syllabus.unitCount === 0 && (
          <div className="note note--error" style={{ marginTop: 14 }}>
            <div>Uploaded, but no readable units/topics could be extracted from this file.</div>
            <div style={{ marginTop: 6 }}>
              {result.note ||
                'The file may be a scanned/image-only document with no selectable text. Re-upload a text-based PDF/DOC/DOCX/TXT/XLS/XLSX/CSV so real content can be extracted.'}
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              This syllabus was saved, but Question Generator will refuse to generate from it until it has real
              content — delete it below and re-upload a readable file.
            </div>
          </div>
        )}

        {result?.kind === 'project' && (
          <div className="note" style={{ marginTop: 14 }}>
            <div>✓ Project requirement uploaded successfully</div>
            <div>✓ Project draft created — “{result.project.title}”</div>
            {result.note && (
              <div style={{ marginTop: 6, opacity: 0.8 }}>Note: {result.note}</div>
            )}
            <div style={{ marginTop: 12 }}>
              <Button size="sm" onClick={() => navigate(`/admin/projects?edit=${result.project.id}`)}>
                Review &amp; Publish
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading syllabi…">
        <Card title="Saved Syllabi" subtitle="Admin-only reference material used as the source for the Question Generator." flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File</th>
                  <th>Units</th>
                  <th>Topics</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">No syllabus uploaded yet.</td>
                  </tr>
                ) : (
                  list.flatMap((s) => {
                    const rows = [
                      <tr key={s.id}>
                        <td>{s.title}</td>
                        <td className="muted">{s.fileName || '—'}</td>
                        <td>{s.unitCount}</td>
                        <td>{s.topicCount}</td>
                        <td className="muted">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Button variant="ghost" size="sm" onClick={() => toggleUnits(s.id)}>
                            {open === s.id ? 'Hide' : 'View'} Units
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/admin/question-generator?syllabus=${s.id}`)}>
                            Generate Questions
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>,
                    ]
                    if (open === s.id) {
                      rows.push(
                        <tr key={`${s.id}-units`}>
                          <td colSpan={6}>
                            {!detail ? (
                              <p className="muted">Loading…</p>
                            ) : detail.units.length === 0 ? (
                              <p className="muted">No units/topics were detected in this file.</p>
                            ) : (
                              <ul className="list-plain" style={{ fontSize: 13 }}>
                                {detail.units.map((u, i) => (
                                  <li key={i} style={{ padding: '3px 0' }}>
                                    <strong>{u.name}:</strong>{' '}
                                    <span className="muted">{u.topics.join(', ')}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>,
                      )
                    }
                    return rows
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </AsyncBlock>
    </>
  )
}
