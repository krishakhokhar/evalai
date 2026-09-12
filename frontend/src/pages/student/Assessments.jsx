import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import AsyncBlock from '../../components/ui/AsyncBlock'
import { useResource } from '../../hooks/useResource'
import { myAssessments } from '../../services/academicApi'

const phaseBadge = {
  available: { variant: 'success', label: 'Available' },
  upcoming: { variant: 'warning', label: 'Upcoming' },
  completed: { variant: 'neutral', label: 'Completed' },
  closed: { variant: 'danger', label: 'Closed' },
}

function Group({ title, items, navigate }) {
  if (items.length === 0) return null
  return (
    <>
      <div className="section-label" style={{ marginTop: 8 }}>{title}</div>
      <div className="grid grid--2" style={{ marginBottom: 20 }}>
        {items.map((a) => {
          const p = phaseBadge[a.phase] || phaseBadge.available
          return (
            <Card key={a.id} title={a.title} subtitle={`${a.subject || 'General'} · ${a.numQuestions} questions · ${a.durationMinutes} min · ${a.totalMarks} marks`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                {a.attempt?.status === 'submitted' ? (
                  <Badge variant="success">Scored {a.attempt.percentage}%</Badge>
                ) : (
                  <Badge variant={p.variant}>{p.label}</Badge>
                )}
                {a.phase === 'available' && (
                  <Button size="sm" onClick={() => navigate(`/student/assessment/${a.id}`)}>
                    {a.attempt ? 'Resume' : 'Start Assessment'}
                  </Button>
                )}
                {a.phase === 'completed' && (
                  <Button size="sm" variant="secondary" to="/student/results">View result</Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

export default function StudentAssessments() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useResource(myAssessments, [])
  const all = data?.assessments ?? []

  return (
    <>
      <PageHeader title="Assessments" subtitle="Published assessments assigned to you." />
      <AsyncBlock loading={loading} error={error} onRetry={reload} loadingText="Loading assessments…">
        {all.length === 0 ? (
          <Card>
            <EmptyState title="No assessments yet" message="Published assessments will appear here." />
          </Card>
        ) : (
          <>
            <Group title="Available" items={all.filter((a) => a.phase === 'available')} navigate={navigate} />
            <Group title="Upcoming" items={all.filter((a) => a.phase === 'upcoming')} navigate={navigate} />
            <Group title="Completed" items={all.filter((a) => a.phase === 'completed')} navigate={navigate} />
            <Group title="Closed" items={all.filter((a) => a.phase === 'closed')} navigate={navigate} />
          </>
        )}
      </AsyncBlock>
    </>
  )
}
