import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export type UploadParams = {
  file: File
  bucketName?: string // GCS のバケット名（関数側でデフォルトあり）
  apartmentId: string // GCS のパス構造に必須
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

  const uploadFile = async ({ file, apartmentId }: UploadParams): Promise<UploadResult | null> => {
    if (!user) {
      setError(new Error('User not authenticated'))
      return null
    }

    try {
      setUploading(true)
      setProgress(0)
      setError(null)

      // 1. GCS 署名付きURLを取得
      const { data, error: functionError } = await supabase.functions.invoke('get-gcs-upload-url', {
        body: {
          fileName: file.name,
          contentType: file.type,
          apartmentId: apartmentId
        }
      });

      if (functionError || !data?.uploadUrl) {
        throw new Error(`Failed to get upload URL: ${functionError?.message || 'Unknown error'}`);
      }

      const { uploadUrl, filePath } = data;

      // 2. GCS へ直接アップロード (XMLHttpRequest を使用して進捗監視)
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            setProgress(Math.round(percent));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve({
              path: filePath,
              url: uploadUrl.split('?')[0] // クエリパラメータを除いた純粋なURL
            });
          } else {
            console.error('GCS Upload Failed:', xhr.responseText);
            reject(new Error(`GCS Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('GCS Upload XHR error'));
        xhr.send(file);
      });

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
