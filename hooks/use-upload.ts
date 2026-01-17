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
      setError(null)

      // ファイル名をユニークにする
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // 公開URLを取得（非公開バケットの場合は署名付きURLが必要だが、今回はとりあえずパスを返す）
      // RLSで閲覧許可されているので、Authenticatedユーザーならダウンロード可能
      
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
    error
  }
}
