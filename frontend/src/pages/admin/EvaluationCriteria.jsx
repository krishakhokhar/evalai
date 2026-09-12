import { useEffect, useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { adminCriteria, updateCriteria } from '../../services/projectApi'

export default function AdminEvaluationCriteria() {
  const { data, loading, error, reload } = useResource(adminCriteria, [])
  const [rows, setRows] = useState([])
  const [note, setNote] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.criteria) setRows(data.criteria.map((c) => ({ ...c })))
  }, [data])

  const total = rows.reduce((s, r) => s + (Number(r.max) || 0), 0)
  const valid = total === 100

  const setMax = (i, value) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, max: value } : r)))

  const save = async () => {
    if (!valid) return
    setSaving(true)
    setNote(null)
    try {
      await updateCriteria(rows.map((r) => ({ name: r.name, max: Number(r.max) })))
      setNote({ type: 'success', text: 'Evaluation rubric saved.' })
      reload()
    } catch (err) {
      setNote({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Evaluation Criteria"
        subtitle="The rubric every project is scored against. The total must stay at 100 marks."
        actions={<Button onClick={save} disabled={!valid || saving}>{saving ? 'Saving…' : 'Save rubric'}</Button>}
      />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading rubric…">
        <Card title="Rubric" actions={<Badge variant={valid ? 'success' : 'danger'}>Total {total}/100</Badge>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Criterion</th><th style={{ width: 160 }}>Marks</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name}>
                    <td className="muted">{i + 1}</td>
                    <td>{r.name}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input"
                        style={{ width: 110 }}
                        value={r.max}
                        onChange={(e) => setMax(i, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td />
                  <td style={{ fontWeight: 600 }}>Total</td>
                  <td style={{ fontWeight: 600 }}>{total} / 100</td>
                </tr>
              </tbody>
            </table>
          </div>
          {note && (
            <div className={`note ${note.type === 'error' ? 'note--error' : ''}`.trim()} style={{ marginTop: 16 }}>
              {note.text}
            </div>
          )}
        </Card>
      </AsyncBlock>
    </>
  )
}
