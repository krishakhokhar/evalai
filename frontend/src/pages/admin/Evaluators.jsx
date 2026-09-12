import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { adminEvaluators } from '../../services/projectApi'

export default function AdminEvaluators() {
  const { data, loading, error, reload } = useResource(adminEvaluators, [])
  const rows = data?.evaluators ?? []

  return (
    <>
      <PageHeader title="Evaluators" subtitle="Registered evaluators and their workload." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading evaluators…">
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Registered</th>
                  <th>Evaluations completed</th><th>Pending</th><th>Avg. evaluation score</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No evaluators registered yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="muted">{r.email}</td>
                      <td className="muted">{new Date(r.registeredAt).toLocaleDateString()}</td>
                      <td>{r.evaluationsCompleted}</td>
                      <td>{r.pendingEvaluations}</td>
                      <td>{r.averageEvaluationScore != null ? `${r.averageEvaluationScore}/100` : '—'}</td>
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
