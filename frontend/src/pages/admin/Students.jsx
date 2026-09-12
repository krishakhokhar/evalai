import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { adminStudents } from '../../services/projectApi'

export default function AdminStudents() {
  const { data, loading, error, reload } = useResource(adminStudents, [])
  const rows = data?.students ?? []

  return (
    <>
      <PageHeader title="Students" subtitle="Assessment and project performance for registered students." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading students…">
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Registered</th><th>Assessments</th><th>Project</th>
                  <th>Assessment score</th><th>Project score</th><th>Overall score</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="muted">No students registered yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="muted">{r.email}</td>
                      <td className="muted">{r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : '—'}</td>
                      <td>{r.assessmentsAttempted ?? 0}</td>
                      <td>{r.project || '—'}</td>
                      <td>{r.assessmentScore != null ? `${r.assessmentScore}%` : '—'}</td>
                      <td>{r.projectScore != null ? `${r.projectScore}/100` : '—'}</td>
                      <td>{r.overallScore != null ? r.overallScore : '—'}</td>
                      <td>
                        <Badge variant={r.status === 'Evaluated' ? 'success' : r.status === 'No submission' ? 'neutral' : 'warning'}>
                          {r.status}
                        </Badge>
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
