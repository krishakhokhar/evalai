import Card from './Card'
import Button from './Button'

export default function AsyncBlock({
  loading,
  error,
  onRetry,
  loadingText = 'Loading…',
  children,
}) {
  if (loading) {
    return (
      <Card>
        <div className="empty">
          <div className="empty__msg">{loadingText}</div>
        </div>
      </Card>
    )
  }
  if (error) {
    return (
      <Card>
        <div className="empty">
          <div className="empty__title">Unable to load</div>
          <p className="empty__msg">{error}</p>
          {onRetry && (
            <div style={{ marginTop: 14 }}>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </Card>
    )
  }
  return children
}
