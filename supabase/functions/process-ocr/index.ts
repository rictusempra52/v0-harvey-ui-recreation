import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { create as createJWT, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { Storage } from "npm:@google-cloud/storage";

interface DocumentRecord {
  id: string;
  file_path: string; // This is now expected to be a GCS path
  apartment_id: string;
}

/**
 * Google Cloud Service Account を用いて Access Token を取得する
 */
async function getAccessToken(gcsJsonStr: string) {
  const gcs = JSON.parse(gcsJsonStr);
  const now = getNumericDate(0);
  const payload = {
    iss: gcs.client_email,
    sub: gcs.client_email,
    aud: gcs.token_uri,
    iat: now,
    exp: getNumericDate(3600), // 1 hour
    scope: "https://www.googleapis.com/auth/cloud-platform",
  };

  const pem = gcs.private_key.replace(/\\n/g, "\n");
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  ).replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await createJWT({ alg: "RS256", typ: "JWT" }, payload, key);

  const response = await fetch(gcs.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function convertToQuadPoints(normalizedVertices: any[], width: number, height: number) {
  const v = normalizedVertices;
  if (!v || v.length < 4) return [0,0,0,0,0,0,0,0];
  return [
    (v[0].x || 0) * width, (v[0].y || 0) * height,
    (v[1].x || 0) * width, (v[1].y || 0) * height,
    (v[3].x || 0) * width, (v[3].y || 0) * height,
    (v[2].x || 0) * width, (v[2].y || 0) * height
  ];
}

/**
 * 再帰的にテキストを抽出するヘルパー（documentLayout 形式用）
 */
function extractTextFromBlocksRecursive(blocks: any[]): string {
  let text = "";
  for (const block of blocks) {
    if (block.textBlock?.text) {
      text += block.textBlock.text + "\n";
    }
    // ネストされたブロックがある場合は再帰的に処理
    if (block.textBlock?.blocks) {
      text += extractTextFromBlocksRecursive(block.textBlock.blocks);
    }
  }
  return text;
}

/**
 * 再帰的にブロックを平坦化するヘルパー（ocr_data 用）
 */
function flattenBlocksRecursive(blocks: any[]): any[] {
  let flat: any[] = [];
  for (const block of blocks) {
    if (block.textBlock?.text) {
      flat.push({
        text: block.textBlock.text,
        quadPoints: [0,0,0,0,0,0,0,0] // Layout Parser では座標取得ロジックが異なるため一旦ダミー
      });
    }
    if (block.textBlock?.blocks) {
      flat = flat.concat(flattenBlocksRecursive(block.textBlock.blocks));
    }
  }
  return flat;
}

Deno.serve(async (req: Request) => {
  let recordId: string | null = null;
  
  try {
    const body = await req.json();
    const { record } = body as { record: DocumentRecord };
    if (!record?.id) return new Response('Invalid record', { status: 400 });
    recordId = record.id;

    // Supabase Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    let sk = Deno.env.get('OCR_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (sk && !sk.includes('.')) {
      try { sk = atob(sk.trim()); } catch (e) {}
    }
    const supabase = createClient(supabaseUrl, sk);

    // Initial status update
    await supabase.from('documents').update({ ocr_status: 'processing' }).eq('id', recordId);

    // Google Cloud Auth
    const gcsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const processorId = Deno.env.get('GOOGLE_DOC_AI_PROCESSOR_ID');
    const gcsLocation = Deno.env.get('GOOGLE_CLOUD_LOCATION') ?? 'us';
    const bucketName = Deno.env.get('GCS_BUCKET_NAME') || 'shimesukun-harvey';
    
    if (!gcsJson || !processorId) throw new Error('Missing Google credentials');
    
    let rawGcsJson = gcsJson;
    if (rawGcsJson && !rawGcsJson.trim().startsWith('{')) {
      try { rawGcsJson = atob(rawGcsJson.trim()); } catch (e) {}
    }
    const credentials = JSON.parse(rawGcsJson);
    const projectId = credentials.project_id;
    const accessToken = await getAccessToken(rawGcsJson);

    // GCS Storage client for result retrieval
    const storage = new Storage({ credentials, projectId });

    // 1. Batch Processing Request
    const inputGcsUri = `gs://${bucketName}/${record.file_path}`;
    const outputGcsUriPrefix = `gs://${bucketName}/ocr-results/${recordId}/${Date.now()}/`;
    
    const endpoint = `https://${gcsLocation}-documentai.googleapis.com/v1/projects/${projectId}/locations/${gcsLocation}/processors/${processorId}:batchProcess`;
    
    const batchRequest = {
      inputDocuments: {
        gcsDocuments: {
          documents: [{ gcsUri: inputGcsUri, mimeType: "application/pdf" }]
        }
      },
      documentOutputConfig: {
        gcsOutputConfig: { gcsUri: outputGcsUriPrefix }
      }
    };

    console.log(`Starting batch process for ${inputGcsUri}`);
    console.log(`Output prefix: ${outputGcsUriPrefix}`);
    const docAiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(batchRequest),
    });

    if (!docAiResponse.ok) {
      const errorText = await docAiResponse.text();
      console.error(`Document AI Batch API Error: ${errorText}`);
      throw new Error(`Document AI Batch API Error: ${errorText} (Endpoint: ${endpoint}, Input: ${inputGcsUri})`);
    }

    const operation = await docAiResponse.json();
    const operationName = operation.name;
    console.log(`Operation started: ${operationName}`);

    // 2. Polling for completion
    let isDone = false;
    let pollCount = 0;
    const maxPolls = 60; // 5 seconds * 60 = 300 seconds (5 minutes)
    
    while (!isDone && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      pollCount++;
      
      const opStatusResponse = await fetch(`https://${gcsLocation}-documentai.googleapis.com/v1/${operationName}`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      
      const opStatus = await opStatusResponse.json();
      if (opStatus.done) {
        if (opStatus.error) {
          console.error("Batch process failed details:", JSON.stringify(opStatus.error, null, 2));
          throw new Error(`Batch process failed: ${JSON.stringify(opStatus.error)} (Input: ${inputGcsUri})`);
        }
        isDone = true;
        console.log("Batch process completed successfully.");
      } else {
        console.log(`Still processing... (attempt ${pollCount})`);
      }
    }

    if (!isDone) throw new Error("Batch process timed out.");

    // 3. Retrieve and Parse JSON results from GCS
    const outputPrefix = outputGcsUriPrefix.replace(`gs://${bucketName}/`, "");
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: outputPrefix });
    console.log(`Found ${files.length} files in output prefix.`);
    
    const jsonFiles = files.filter(f => f.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name));
    if (jsonFiles.length === 0) throw new Error("Result JSON not found in GCS.");

    let fullExtractedText = "";
    let allOcrPages: any[] = [];
    let debugInfo = `Files found: ${jsonFiles.map(f => f.name).join(", ")}\n`;

    for (const jsonFile of jsonFiles) {
      const [content] = await jsonFile.download();
      const resultDoc = JSON.parse(content.toString());
      
      const shardText = resultDoc.text || "";
      fullExtractedText += shardText;
      debugInfo += `\nShard ${jsonFile.name}: keys=[${Object.keys(resultDoc).join(", ")}], textLen=${shardText.length}`;

      // --- Result Extraction Logic (Shard Level) ---
      let shardPages: any[] = [];

      // Case A: Standard Document AI format (text + pages)
      if (resultDoc.pages && resultDoc.pages.length > 0) {
        shardPages = resultDoc.pages.map((page: any) => {
          const { width, height } = page.dimension || { width: 0, height: 0 };
          const blocks = page.blocks?.map((block: any) => ({
              text: shardText.substring(block.layout?.textAnchor?.textSegments?.[0]?.startIndex || 0, block.layout?.textAnchor?.textSegments?.[0]?.endIndex || 0),
              quadPoints: convertToQuadPoints(block.layout?.boundingPoly?.normalizedVertices, width, height)
          })) || [];
          return { page_number: page.pageNumber, dimensions: { width, height }, blocks };
        });
      } 
      // Case B: Document Layout Parser format (documentLayout.blocks)
      else if (resultDoc.documentLayout?.blocks) {
        const blocks = resultDoc.documentLayout.blocks;
        // Text is often already in shardText, but if not, extract from blocks
        if (!shardText && blocks.length > 0) {
          fullExtractedText += extractTextFromBlocksRecursive(blocks).trim();
        }
        
        shardPages = [{
          page_number: 1, // Layout Parser might span pages, but for now simplify
          dimensions: { width: 1000, height: 1000 },
          blocks: flattenBlocksRecursive(blocks)
        }];
      }
      
      allOcrPages = allOcrPages.concat(shardPages);
    }

    // If still empty text, put debug info into ocr_text
    const finalOcrText = fullExtractedText || `DEBUG: No text found. ${debugInfo}`;

    await supabase
      .from('documents')
      .update({
        ocr_text: finalOcrText,
        ocr_data: { pages: allOcrPages.slice(0, 100) }, // Cap at 100 pages for safety
        ocr_status: 'completed'
      })
      .eq('id', recordId);

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Master Error:", message);
    if (recordId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        let sk = Deno.env.get('OCR_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, sk);
        await supabase.from('documents').update({ 
            ocr_status: 'failed',
            ocr_text: `ERROR: ${message}` 
        }).eq('id', recordId);
      } catch (dbErr) { console.error(dbErr); }
    }
    return new Response("Internal Server Error", { status: 500 });
  }
});
