import { useCallback, useEffect, useState } from 'react'

// Small data-fetching helper: returns { data, loading, error, reload }.
export function useResource(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  const load = useCallback(() => {
    let alive = true
    setLoading(true)
    setError(null)
    run()
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message || 'Something went wrong.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [run])

  useEffect(load, [load])

  return { data, loading, error, reload: load }
}
