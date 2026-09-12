import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { completedEvaluations } from '../../services/evaluationApi'

export default function EvaluatorCompleted() {
  const { data, loading, error, reload } = useResource(completedEvaluations, [])
  const rows = data?.projects ?? []

  return (
    <>
      <PageHeader title="Completed Evaluations" subtitle="Projects you have already scored." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading evaluations…">
        {rows.length === 0 ? (
          <Card>
            <EmptyState title="No completed evaluations yet" message="Evaluate a pending project to see it here." />
          </Card>
        ) : (
          <Card flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Student</th><th>Project</th><th>Technology</th><th>Final score</th><th>Date</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.student}</td>
                      <td>{r.project}</td>
                      <td className="muted">{r.technology}</td>
                      <td><Badge variant="success">{r.score}/100</Badge></td>
                      <td className="muted">{new Date(r.date).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Button to={`/evaluator/evaluate/${r.id}`} variant="secondary" size="sm">View</Button>
                      </td>
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
