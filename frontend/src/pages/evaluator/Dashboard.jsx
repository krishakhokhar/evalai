import PageHeader from '../../components/ui/PageHeader'
import Card, { StatCard } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { Donut, BarChart, ColumnChart } from '../../components/ui/Charts'
import { useResource } from '../../hooks/useResource'
import { evaluatorDashboard, pendingEvaluations } from '../../services/evaluationApi'

export default function EvaluatorDashboard() {
  const stats = useResource(evaluatorDashboard, [])
  const queue = useResource(pendingEvaluations, [])
  const d = stats.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your evaluation workload at a glance."
        actions={<Button to="/evaluator/pending">Open queue</Button>}
      />

      <AsyncBlock loading={stats.loading} error={stats.error} onRetry={stats.reload}>
        {d && (
          <>
            <div className="grid grid--3" style={{ marginBottom: 20 }}>
              <StatCard label="Pending evaluations" value={d.pending} />
              <StatCard label="Completed evaluations" value={d.completed} />
              <StatCard label="Average evaluation score" value={d.completed ? `${d.averageScore}/100` : '—'} />
            </div>

            <div className="grid grid--3" style={{ marginBottom: 20 }}>
              <Card title="Workload">
                <Donut
                  segments={[
                    { label: 'Completed', value: d.completed, color: 'var(--success)' },
                    { label: 'Pending', value: d.pending, color: 'var(--warning)' },
                  ]}
                />
              </Card>
              <Card title="Average marks per criterion">
                <BarChart
                  unit=""
                  data={(d.criteriaAverages || []).map((c) => ({ label: c.key, value: c.avg }))}
                  max={Math.max(1, ...(d.criteriaAverages || []).map((c) => c.max))}
                />
              </Card>
              <Card title="Evaluation score history (%)">
                <ColumnChart data={d.scoreHistory || []} />
              </Card>
            </div>
          </>
        )}
      </AsyncBlock>

      <AsyncBlock loading={queue.loading} error={queue.error} onRetry={queue.reload} loadingText="Loading queue…">
        <Card title="Next in queue" flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Project</th><th>Technology</th><th>Submitted</th><th /></tr>
              </thead>
              <tbody>
                {(queue.data?.projects ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="muted">No projects waiting for evaluation.</td></tr>
                ) : (
                  queue.data.projects.map((p) => (
                    <tr key={p.id}>
                      <td>{p.student}</td>
                      <td>{p.project}</td>
                      <td className="muted">{p.technology}</td>
                      <td className="muted">{new Date(p.submittedAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Button to={`/evaluator/evaluate/${p.id}`} size="sm">Evaluate</Button>
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
