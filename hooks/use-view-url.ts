import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function useViewUrl(filePath: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    if (!filePath) {
      setUrl(null)
      return
    }

    const fetchSignedUrl = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: functionError } = await supabase.functions.invoke('get-gcs-view-url', {
          body: { filePath }
        })

        if (functionError) throw functionError
        if (!data?.url) throw new Error('Failed to get signed URL')

        setUrl(data.url)
      } catch (err) {
        console.error('Error fetching signed URL:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        // 失敗した場合はフォールバックとして元々のパス（エラーにはなるが見かけ上の整合性）をセットするか検討
        // 今回はエラー状態にする
      } finally {
        setLoading(false)
      }
    }

    fetchSignedUrl()
  }, [filePath, supabase])

  return { url, loading, error }
}
