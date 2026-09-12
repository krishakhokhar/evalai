import PageHeader from '../../components/ui/PageHeader'
import Card, { StatCard } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { BarChart, Donut, ColumnChart } from '../../components/ui/Charts'
import { useResource } from '../../hooks/useResource'
import { adminDashboard } from '../../services/projectApi'

const statusVariant = { evaluated: 'success', under_review: 'info', submitted: 'warning' }

export default function AdminDashboard() {
  const { data, loading, error, reload } = useResource(adminDashboard, [])

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live platform overview from the database."
        actions={<Button to="/admin/evaluation-criteria">Evaluation criteria</Button>}
      />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading dashboard…">
        {data && (
          <>
            <div className="grid grid--stats" style={{ marginBottom: 20 }}>
              <StatCard label="Total students" value={data.stats.totalStudents} />
              <StatCard label="Total evaluators" value={data.stats.totalEvaluators} />
              <StatCard label="Published assessments" value={data.stats.publishedAssessments ?? 0} />
              <StatCard label="Submitted projects" value={data.stats.submittedProjects} />
              <StatCard label="Pending evaluations" value={data.stats.pendingEvaluations} />
              <StatCard label="Completed evaluations" value={data.stats.completedEvaluations} />
              <StatCard label="Average score" value={data.stats.averageScore ? `${data.stats.averageScore}` : 'No data yet'} />
            </div>

            {data.analytics && (
              <>
                <div className="grid grid--3" style={{ marginBottom: 20 }}>
                  <Card title="Assessment pass / fail">
                    <Donut
                      segments={[
                        { label: 'Pass', value: data.analytics.passFail.pass, color: 'var(--success)' },
                        { label: 'Fail', value: data.analytics.passFail.fail, color: 'var(--danger)' },
                      ]}
                    />
                  </Card>
                  <Card title="Evaluation progress">
                    <Donut
                      segments={[
                        { label: 'Completed', value: data.analytics.evaluationProgress.completed, color: 'var(--success)' },
                        { label: 'Pending', value: data.analytics.evaluationProgress.pending, color: 'var(--warning)' },
                      ]}
                    />
                  </Card>
                  <Card title="Submission status">
                    <Donut
                      segments={[
                        { label: 'Submitted', value: data.analytics.submissionStatus?.submitted ?? 0, color: 'var(--warning)' },
                        { label: 'Under review', value: data.analytics.submissionStatus?.underReview ?? 0, color: 'var(--info)' },
                        { label: 'Evaluated', value: data.analytics.submissionStatus?.evaluated ?? 0, color: 'var(--success)' },
                      ]}
                    />
                  </Card>
                </div>
                <div className="grid grid--2" style={{ marginBottom: 20 }}>
                  <Card title="Subject-wise performance (avg %)">
                    <BarChart data={data.analytics.subjectPerformance.map((s) => ({ label: s.subject, value: s.avgPercent }))} />
                  </Card>
                  <Card title="Project evaluation scores">
                    <ColumnChart
                      data={(data.analytics.projectScores || []).map((v, i) => ({ label: `#${i + 1}`, value: v }))}
                    />
                  </Card>
                </div>
              </>
            )}

            <Card title="Recent submissions" flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Student</th><th>Project</th><th>Technology</th><th>Submitted</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {data.recentSubmissions.length === 0 ? (
                      <tr><td colSpan={5} className="muted">No project submissions yet.</td></tr>
                    ) : (
                      data.recentSubmissions.map((s) => (
                        <tr key={s.id}>
                          <td>{s.student}</td>
                          <td>{s.project}</td>
                          <td className="muted">{s.technology}</td>
                          <td className="muted">{new Date(s.submittedAt).toLocaleDateString()}</td>
                          <td><Badge variant={statusVariant[s.status] || 'neutral'}>{s.status.replace('_', ' ')}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </AsyncBlock>
    </>
  )
}
