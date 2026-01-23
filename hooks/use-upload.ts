import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export type UploadParams = {
  file: File
  bucketName?: string
  apartmentId?: string // メタデータ保存用（将来的）
}

export type UploadResult = {
  path: string
  url: string
}

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()
  const supabase = createClient()

  const uploadFile = async ({ file, bucketName = 'pdfs' }: UploadParams): Promise<UploadResult | null> => {
    if (!user) {
      setError(new Error('User not authenticated'))
      return null
    }

    try {
      setUploading(true)
      setProgress(0)
      setError(null)

      // ファイル名をユニークにする
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError, data } = await (supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          onUploadProgress: (progress: any) => {
            const percent = (progress.loaded / progress.total) * 100
            setProgress(Math.round(percent))
          }
        } as any))

      if (uploadError) {
        throw uploadError
      }
      
      return {
        path: filePath,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err : new Error('Upload failed'))
      return null
    } finally {
      setUploading(false)
    }
  }

  return {
    uploadFile,
    uploading,
    progress,
    error
  }
}
