import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { create as createJWT, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

interface DocumentRecord {
  id: string;
  file_path: string;
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

Deno.serve(async (req: Request) => {
  let recordId: string | null = null;
  
  const getDiagnostics = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    let sk = Deno.env.get('OCR_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || '';
    if (sk && !sk.includes('.')) {
      try {
        const decoded = atob(sk.trim());
        if (decoded.includes('.')) sk = decoded;
      } catch (e) {}
    }
    return { 
        supabaseUrl, 
        supabaseServiceKey: sk, 
        supabaseAnonKey: anon, 
        info: `V40_STACK: sk=${sk.length}`, 
        detail: `D: ${sk.substring(0, 5)}...${sk.substring(sk.length - 5)}`
    };
  };

  try {
    const body = await req.json();
    const { record } = body as { record: DocumentRecord };
    if (!record?.id) return new Response('Invalid record', { status: 400 });
    recordId = record.id;

    const { supabaseUrl, supabaseServiceKey, supabaseAnonKey, info, detail } = getDiagnostics();
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    await supabase.from('documents').update({ ocr_status: 'processing' }).eq('id', recordId);

    const gcsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const processorId = Deno.env.get('GOOGLE_DOC_AI_PROCESSOR_ID');
    const gcsLocation = Deno.env.get('GOOGLE_CLOUD_LOCATION') ?? 'us';
    if (!gcsJson || !processorId) throw new Error('Missing Google credentials');

    let rawGcsJson = gcsJson;
    if (rawGcsJson && !rawGcsJson.trim().startsWith('{')) {
      try { rawGcsJson = atob(rawGcsJson.trim()); } catch (e) {}
    }
    const gcs = JSON.parse(rawGcsJson);
    const projectId = gcs.project_id;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(record.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${JSON.stringify(downloadError)}`);
    }

    const accessToken = await getAccessToken(rawGcsJson);
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Stack-safe conversion
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);
    
    const endpoint = `https://${gcsLocation}-documentai.googleapis.com/v1/projects/${projectId}/locations/${gcsLocation}/processors/${processorId}:process`;
    const docAiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rawDocument: { content: base64Content, mimeType: "application/pdf" } }),
    });

    if (!docAiResponse.ok) throw new Error(`Document AI API Error: ${await docAiResponse.text()}`);

    const resultBody = await docAiResponse.json();
    const document = resultBody.document || resultBody;
    
    let extractedText = document.text || "";
    if (!extractedText && document.documentLayout) {
        extractedText = document.documentLayout.blocks?.map((b: any) => b.textBlock?.text).join("\n") || "";
    }

    const ocrPages = (document.pages || []).slice(0, 10).map((page: any) => {
      const { width, height } = page.dimension || { width: 0, height: 0 };
      const blocks = page.blocks?.map((block: any) => ({
          text: extractedText.substring(block.layout?.textAnchor?.textSegments?.[0]?.startIndex || 0, block.layout?.textAnchor?.textSegments?.[0]?.endIndex || 0),
          quadPoints: convertToQuadPoints(block.layout?.boundingPoly?.normalizedVertices, width, height)
      })) || [];
      return { page_number: page.pageNumber, dimensions: { width, height }, blocks };
    });

    await supabase
      .from('documents')
      .update({
        ocr_text: extractedText,
        ocr_data: { pages: ocrPages },
        ocr_status: 'completed'
      })
      .eq('id', recordId);

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (recordId) {
      try {
        const { supabaseUrl, supabaseServiceKey, supabaseAnonKey, info, detail } = getDiagnostics();
        const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
        await supabase.from('documents').update({ 
            ocr_status: 'failed',
            ocr_text: `${info} | ${detail} | ERROR: ${message}` 
        }).eq('id', recordId);
      } catch (dbErr) { console.error(dbErr); }
    }
    return new Response(message, { status: 500 });
  }
});
