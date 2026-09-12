import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { adminEvaluations } from '../../services/projectApi'

export default function AdminEvaluations() {
  const { data, loading, error, reload } = useResource(adminEvaluations, [])
  const rows = data?.evaluations ?? []

  return (
    <>
      <PageHeader title="Evaluations" subtitle="Completed project evaluations from the database." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading evaluations…">
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Project</th><th>Evaluator</th><th>Score</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No evaluations available yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.student}</td>
                      <td>{r.project}</td>
                      <td className="muted">{r.evaluator}</td>
                      <td>{r.score}/100</td>
                      <td><Badge variant="success">{r.status}</Badge></td>
                      <td className="muted">{new Date(r.date).toLocaleDateString()}</td>
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
