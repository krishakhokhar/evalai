import PageHeader from '../../components/ui/PageHeader'
import Card, { StatCard } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { DonutStat, ColumnChart } from '../../components/ui/Charts'
import { useAuth } from '../../context/AuthContext'
import { useResource } from '../../hooks/useResource'
import { studentDashboard } from '../../services/projectApi'
import { myAssessments } from '../../services/academicApi'

const statusLabel = { submitted: 'Submitted', under_review: 'Under Evaluation', evaluated: 'Evaluated' }
const activityIcon = { assessment: '📝', submission: '📦', evaluation: '✅' }

export default function StudentDashboard() {
  const { user } = useAuth()
  const dash = useResource(studentDashboard, [])
  const assess = useResource(myAssessments, [])

  const list = assess.data?.assessments ?? []
  const availablePublished = list.filter((a) => a.phase === 'available')
  const completedList = list.filter((a) => a.phase === 'completed')
  const s = dash.data?.summary
  const task = dash.data?.projectTask
  const perf = dash.data?.performance
  const activity = dash.data?.recentActivity ?? []

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] || 'Student'}`}
        subtitle={user?.email}
        actions={<Button to="/student/project-submission">Submit project</Button>}
      />

      {/* 2. Summary cards */}
      <AsyncBlock loading={dash.loading} error={dash.error} onRetry={dash.reload} loadingText="Loading your dashboard…">
        {s && (
          <div className="grid grid--stats" style={{ marginBottom: 20 }}>
            <StatCard label="Available assessments" value={s.availableAssessments} />
            <StatCard label="Completed assessments" value={s.completedAssessments} />
            <StatCard label="Assigned projects" value={s.assignedProjects} />
            <StatCard label="Submitted projects" value={s.submittedProjects} />
            <StatCard label="Average score" value={s.averageScore != null ? `${s.averageScore}%` : '—'} />
            <StatCard label="Evaluation status" value={s.evaluationStatus} />
          </div>
        )}
      </AsyncBlock>

      {/* 3. Published Project Task */}
      <AsyncBlock loading={dash.loading} error={dash.error} onRetry={dash.reload}>
        {dash.data && (
          <Card
            title="Project task"
            style={{ marginBottom: 20 }}
            actions={task && <Button size="sm" to="/student/project-submission">Open &amp; submit</Button>}
          >
            {task ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.title}</div>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {task.techStack && `Stack: ${task.techStack}`}
                  {task.deadline ? ` · Due ${new Date(task.deadline).toLocaleDateString()}` : ''}
                  {task.maxMarks ? ` · ${task.maxMarks} marks` : ''}
                </div>
                {task.description && <p className="muted" style={{ marginBottom: 8 }}>{task.description}</p>}
                {task.requirements?.length > 0 && (
                  <ul className="list-plain evidence">
                    {task.requirements.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="muted">No project task has been published yet.</p>
            )}
          </Card>
        )}
      </AsyncBlock>

      {/* 4. Published Assessments */}
      <AsyncBlock loading={assess.loading} error={assess.error} onRetry={assess.reload} loadingText="Loading assessments…">
        <div className="grid grid--2" style={{ marginBottom: 20 }}>
          <Card title="Available assessments">
            {availablePublished.length === 0 ? (
              <p className="muted">No assessments available right now.</p>
            ) : (
              <ul className="list-plain stack" style={{ gap: 10 }}>
                {availablePublished.map((a) => (
                  <li key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>{a.title} <span className="muted">· {a.numQuestions}Q · {a.durationMinutes}m · {a.totalMarks} marks</span></span>
                    <Button size="sm" to={`/student/assessment/${a.id}`}>Start</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Completed assessments">
            {completedList.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <ul className="list-plain">
                {completedList.map((a) => (
                  <li key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{a.title}</span>
                    <Badge variant="success">{a.attempt?.percentage}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </AsyncBlock>

      {/* 5. Recent activity  +  6. Performance overview */}
      <AsyncBlock loading={dash.loading} error={dash.error} onRetry={dash.reload}>
        {dash.data && (
          <div className="grid grid--2" style={{ marginBottom: 20 }}>
            <Card title="Recent activity">
              {activity.length === 0 ? (
                <p className="muted">Nothing yet. Take an assessment or submit your project to get started.</p>
              ) : (
                <ul className="list-plain stack" style={{ gap: 10 }}>
                  {activity.map((ev, i) => (
                    <li key={i} className="row" style={{ justifyContent: 'space-between' }}>
                      <span>{activityIcon[ev.type] || '•'} {ev.text}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{new Date(ev.at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Performance overview">
              {perf && perf.averageScore != null ? (
                <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <DonutStat value={perf.averageScore} label="Average score" sublabel={`${perf.averageScore}%`} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="section-label">Assessment history</div>
                    <ColumnChart data={perf.history} />
                  </div>
                </div>
              ) : (
                <p className="muted">Graphs appear here once your results are available.</p>
              )}
            </Card>
          </div>
        )}
      </AsyncBlock>

      {/* Latest submission snapshot */}
      <AsyncBlock loading={dash.loading} error={dash.error} onRetry={dash.reload}>
        {dash.data && (
          <Card title="My latest submission">
            {dash.data.project ? (
              <ul className="list-plain kv">
                <li><span className="muted">Project</span><span>{dash.data.project.projectTitle || dash.data.project.projectName}</span></li>
                <li><span className="muted">Submitted</span><span>{new Date(dash.data.project.submittedAt).toLocaleDateString()}</span></li>
                <li>
                  <span className="muted">Status</span>
                  <Badge variant={dash.data.project.status === 'evaluated' ? 'success' : 'warning'}>
                    {statusLabel[dash.data.project.status] || dash.data.project.status}
                  </Badge>
                </li>
                {dash.data.project.status === 'evaluated' && dash.data.project.score != null && (
                  <li><span className="muted">Score</span><span>{dash.data.project.score}/{dash.data.project.maxMarks || 100}</span></li>
                )}
              </ul>
            ) : (
              <p className="muted">No project submitted yet. <Button to="/student/project-submission" variant="ghost" size="sm">Submit now</Button></p>
            )}
          </Card>
        )}
      </AsyncBlock>
    </>
  )
}
