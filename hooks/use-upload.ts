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
          contentType: file.type || 'application/pdf', // Ensure fallback matches signing
          apartmentId: apartmentId
        }
      });

      if (functionError || !data?.uploadUrl) {
        throw new Error(`Failed to get upload URL: ${functionError?.message || 'Unknown error'}`);
      }

      const { uploadUrl, filePath } = data;

      // 2. GCS へ直接アップロード (XMLHttpRequest を使用して進捗監視)
      return new Promise((resolve, reject) => {
        const contentType = file.type || 'application/pdf';
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);

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
              url: uploadUrl.split('?')[0]
            });
          } else {
            const statusText = xhr.statusText || 'No status text';
            console.error('GCS Upload Failed. Status:', xhr.status, statusText);
            console.error('Response:', xhr.responseText);
            reject(new Error(`GCS Upload failed with status ${xhr.status} (${statusText})`));
          }
        };

        xhr.onerror = () => {
          console.error('XHR Error occurred during GCS upload. This is often a CORS issue or network error.');
          console.error('Uploaded URL (check for validity):', uploadUrl);
          reject(new Error('GCS Upload XHR error. Please verify your GCS Bucket CORS settings.'));
        };

        xhr.onabort = () => reject(new Error('GCS Upload aborted'));
        xhr.ontimeout = () => reject(new Error('GCS Upload timed out'));

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
