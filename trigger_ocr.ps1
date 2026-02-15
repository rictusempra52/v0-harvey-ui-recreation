$json = '{
  "record": {
    "id": "dcd92062-3659-4205-958c-e23e6d7aa618",
    "file_path": "3b357a79-ff52-4a43-a0ac-853901071408/1770711924724_pgmnishiarai.pdf",
    "apartment_id": "3b357a79-ff52-4a43-a0ac-853901071408"
  },
  "skipProcessing": true,
  "existingLayoutUri": "gs://shimesukun-harvey/ocr-results/dcd92062-3659-4205-958c-e23e6d7aa618/1770713590559/13377861670514942809/0/",
  "existingOcrUri": "gs://shimesukun-harvey/ocr-results/dcd92062-3659-4205-958c-e23e6d7aa618/1770711927973/15991920954350963279/0/"
}'

$uri = "https://odowiifiatfqvqabsyuz.supabase.co/functions/v1/process-ocr"
$headers = @{
    "Authorization" = "Bearer my-temp-token-recover"
    "Content-Type"  = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $json -Headers $headers
    $response | ConvertTo-Json
} catch {
    Write-Error "Request failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Error "Response body: $body"
    }
}
