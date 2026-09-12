import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { pendingEvaluations } from '../../services/evaluationApi'

const statusLabel = { submitted: 'Submitted', under_review: 'Under Review' }

export default function EvaluatorPending() {
  const { data, loading, error, reload } = useResource(pendingEvaluations, [])
  const projects = data?.projects ?? []

  return (
    <>
      <PageHeader title="Pending Evaluations" subtitle="Submitted projects waiting for review." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading projects…">
        {projects.length === 0 ? (
          <Card>
            <EmptyState title="Nothing pending" message="No projects waiting for evaluation." />
          </Card>
        ) : (
          <Card flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th><th>Project</th><th>Task</th><th>Technology</th><th>Submitted</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>{p.student}</td>
                      <td>{p.project}</td>
                      <td className="muted">{p.projectTask || '—'}</td>
                      <td className="muted">{p.technology}</td>
                      <td className="muted">{new Date(p.submittedAt).toLocaleDateString()}</td>
                      <td><Badge variant="warning">{statusLabel[p.status] || p.status}</Badge></td>
                      <td><Button to={`/evaluator/evaluate/${p.id}`} size="sm">Evaluate</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </AsyncBlock>
    </>
  )
}
