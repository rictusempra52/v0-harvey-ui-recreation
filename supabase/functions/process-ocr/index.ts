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
  
  // デバッグ: normalizedVertices の構造を詳細に確認
  console.log('[convertToQuadPoints] normalizedVertices:', JSON.stringify(v, null, 2));
  console.log('[convertToQuadPoints] Type:', typeof v, 'IsArray:', Array.isArray(v), 'Length:', v?.length);
  
  if (!v || v.length < 4) {
    console.warn('[convertToQuadPoints] Invalid vertices - returning zeros. Length:', v?.length);
    return [0,0,0,0,0,0,0,0];
  }
  // Document AI (normalized) -> Adobe PDF Embed API (points, bottom-left origin)
  // q1: top-left, q2: top-right, q3: bottom-right, q4: bottom-left
  // Adobe quadPoints: [x1, y1, x2, y2, x3, y3, x4, y4]
  // Document AI coordinates are (0,0) top-left, (1,1) bottom-right
  // PDF coordinates are (0,0) bottom-left
  return [
    (v[0].x || 0) * width, (1 - (v[0].y || 0)) * height,
    (v[1].x || 0) * width, (1 - (v[1].y || 0)) * height,
    (v[2].x || 0) * width, (1 - (v[2].y || 0)) * height,
    (v[3].x || 0) * width, (1 - (v[3].y || 0)) * height
  ];
}

/**
 * 再帰的にテキストを抽出するヘルパー（documentLayout 形式用）
 */
function extractTextFromBlocksRecursive(blocks: any[]): string {
  let text = "";
  for (const block of blocks) {
    // 段落テキスト
    if (block.textBlock?.text) {
      text += block.textBlock.text + "\n";
    }
    // 表形式
    if (block.tableBlock?.headerRows) {
      for (const row of block.tableBlock.headerRows) {
        if (row.cells) {
          for (const cell of row.cells) {
            if (cell.blocks) text += extractTextFromBlocksRecursive(cell.blocks);
          }
        }
      }
    }
    if (block.tableBlock?.bodyRows) {
      for (const row of block.tableBlock.bodyRows) {
        if (row.cells) {
          for (const cell of row.cells) {
            if (cell.blocks) text += extractTextFromBlocksRecursive(cell.blocks);
          }
        }
      }
    }
    // リスト形式
    if (block.listBlock?.listEntries) {
      for (const entry of block.listBlock.listEntries) {
        if (entry.blocks) text += extractTextFromBlocksRecursive(entry.blocks);
      }
    }
    // 入れ子構造のブロック
    if (block.textBlock?.blocks) {
      text += extractTextFromBlocksRecursive(block.textBlock.blocks);
    }
  }
  return text;
}

/**
 * 再帰的にブロックを平坦化するヘルパー（ocr_data 用）
 */
/**
 * 複数のパスから頂点情報（normalizedVertices）を試行して取得するヘルパー
 */
function getVerticesFromBlock(block: any): any[] | null {
  // 1. Standard OCR: block.layout.boundingPoly.normalizedVertices
  if (block.layout?.boundingPoly?.normalizedVertices) return block.layout.boundingPoly.normalizedVertices;
  // 2. Layout Parser variant A: block.pageLayouts[0].boundingPoly.normalizedVertices
  if (block.pageLayouts?.[0]?.boundingPoly?.normalizedVertices) return block.pageLayouts[0].boundingPoly.normalizedVertices;
  // 3. Layout Parser variant B: block.boundingBox.normalizedVertices
  if (block.boundingBox?.normalizedVertices) return block.boundingBox.normalizedVertices;
  return null;
}

/**
 * 再帰的にブロックを処理し、ページごとにグルーピングする（ocr_data 用）
 */
function processBlocksRecursive(blocks: any[], width: number, height: number, pagesMap: Map<number, any[]>): void {
  for (const block of blocks) {
    // 1. テキストブロックの処理
    if (block.textBlock?.text) {
      const pageNum = block.pageSpan?.pageStart || 1;
      const normalizedVertices = getVerticesFromBlock(block);
      
      if (!pagesMap.has(pageNum)) {
        pagesMap.set(pageNum, []);
      }
      
      pagesMap.get(pageNum)!.push({
        text: block.textBlock.text,
        quadPoints: normalizedVertices 
          ? convertToQuadPoints(normalizedVertices, width, height)
          : [0,0,0,0,0,0,0,0]
      });

      if (!normalizedVertices) {
        console.warn(`[OCR Debug] Vertex not found. ID: ${block.blockId}, type: ${block.type}, keys: ${Object.keys(block).join(", ")}`);
      }
    }

    // 2. 表（Table）の処理
    const tableRows = [...(block.tableBlock?.headerRows || []), ...(block.tableBlock?.bodyRows || [])];
    if (tableRows.length > 0) {
      for (const row of tableRows) {
        if (row.cells) {
          for (const cell of row.cells) {
            if (cell.blocks) processBlocksRecursive(cell.blocks, width, height, pagesMap);
          }
        }
      }
    }

    // 3. リスト（List）の処理
    if (block.listBlock?.listEntries) {
      for (const entry of block.listBlock.listEntries) {
        if (entry.blocks) processBlocksRecursive(entry.blocks, width, height, pagesMap);
      }
    }

    // 4. 入れ子構造のテキストブロックの処理
    if (block.textBlock?.blocks) {
      processBlocksRecursive(block.textBlock.blocks, width, height, pagesMap);
    }
  }
}

Deno.serve(async (req: Request) => {
  let recordId: string | null = null;
  
  try {
    // セキュリティチェック: 独自トークンの検証
    const authHeader = req.headers.get('Authorization');
    const triggerToken = Deno.env.get('OCR_TRIGGER_TOKEN');
    if (!triggerToken || authHeader !== `Bearer ${triggerToken}`) {
      console.warn(`Unauthorized access attempt. Token mismatch or missing.`);
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { record, skipProcessing, existingLayoutUri, existingOcrUri } = body as { 
      record: DocumentRecord, 
      skipProcessing?: boolean,
      existingLayoutUri?: string,
      existingOcrUri?: string
    };
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
    // 両Processorに対応: Layout Parser (RAG用) と Standard OCR (座標用)
    const layoutParserId = Deno.env.get('GOOGLE_DOC_AI_LAYOUT_PARSER_ID') || Deno.env.get('GOOGLE_DOC_AI_PROCESSOR_ID');
    const standardOcrId = Deno.env.get('GOOGLE_DOC_AI_STANDARD_OCR_ID');
    const gcsLocation = Deno.env.get('GOOGLE_CLOUD_LOCATION') ?? 'us';
    const bucketName = Deno.env.get('GCS_BUCKET_NAME') || 'shimesukun-harvey';
    
    if (!gcsJson || !layoutParserId) throw new Error('Missing Google credentials or Layout Parser ID');
    console.log(`Using Layout Parser: ${!!layoutParserId}, Standard OCR: ${!!standardOcrId}`);
    
    let rawGcsJson = gcsJson;
    if (rawGcsJson && !rawGcsJson.trim().startsWith('{')) {
      try { rawGcsJson = atob(rawGcsJson.trim()); } catch (e) {}
    }
    const credentials = JSON.parse(rawGcsJson);
    const projectId = credentials.project_id;
    const accessToken = await getAccessToken(rawGcsJson);

    // GCS Storage client for result retrieval
    const storage = new Storage({ credentials, projectId });

    // Helper: バッチ処理を開始
    async function startBatchProcess(processorId: string, outputSuffix: string) {
      const inputGcsUri = `gs://${bucketName}/${record.file_path}`;
      const timestamp = Date.now();
      const outputGcsUriPrefix = `gs://${bucketName}/ocr-results/${recordId}/${timestamp}/${outputSuffix}/`;
      
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

      console.log(`[${outputSuffix}] Starting batch process for ${inputGcsUri}`);
      console.log(`[${outputSuffix}] Output prefix: ${outputGcsUriPrefix}`);
      
      const docAiResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(batchRequest),
      });

      if (!docAiResponse.ok) {
        const errorText = await docAiResponse.text();
        console.error(`[${outputSuffix}] Document AI Batch API Error: ${errorText}`);
        throw new Error(`[${outputSuffix}] Document AI Batch API Error: ${errorText}`);
      }

      const operation = await docAiResponse.json();
      console.log(`[${outputSuffix}] Operation started: ${operation.name}`);
      return { operation, outputGcsUriPrefix };
    }

    // 1 & 2. 各Processorの処理（再利用または新規実行）
    const layoutDetails = { type: 'layout', outputGcsUriPrefix: '' as string, operationName: '' };
    const ocrDetails = { type: 'ocr', outputGcsUriPrefix: '' as string, operationName: '' };

    // Layout Parser
    if (skipProcessing && existingLayoutUri) {
      console.log(`[Layout Parser] Reusing existing results: ${existingLayoutUri}`);
      layoutDetails.outputGcsUriPrefix = existingLayoutUri;
    } else {
      const { operation, outputGcsUriPrefix } = await startBatchProcess(layoutParserId, 'layout');
      await waitForOperation(operation.name, 'Layout Parser');
      layoutDetails.outputGcsUriPrefix = outputGcsUriPrefix;
    }

    // Standard OCR (Optional)
    let hasOcrResult = false;
    if (standardOcrId || (skipProcessing && existingOcrUri)) {
      if (skipProcessing && existingOcrUri) {
        console.log(`[Standard OCR] Reusing existing results: ${existingOcrUri}`);
        ocrDetails.outputGcsUriPrefix = existingOcrUri;
        hasOcrResult = true;
      } else if (standardOcrId) {
        const { operation, outputGcsUriPrefix } = await startBatchProcess(standardOcrId, 'ocr');
        await waitForOperation(operation.name, 'Standard OCR');
        ocrDetails.outputGcsUriPrefix = outputGcsUriPrefix;
        hasOcrResult = true;
      }
    }
    
    console.log('OCR processing (or result preparation) completed');

    // Helper: GCSから結果を取得
    async function fetchProcessorResults(outputGcsUriPrefix: string, label: string) {
      const outputPrefix = outputGcsUriPrefix.replace(`gs://${bucketName}/`, "");
      const [files] = await storage.bucket(bucketName).getFiles({ prefix: outputPrefix });
      console.log(`[${label}] Found ${files.length} files in output prefix`);
      
      const jsonFiles = files.filter(f => f.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name));
      if (jsonFiles.length === 0) {
        console.warn(`[${label}] No JSON files found`);
        return null;
      }

      const results = [];
      for (const jsonFile of jsonFiles) {
        const [content] = await jsonFile.download();
        const resultDoc = JSON.parse(content.toString());
        results.push(resultDoc);
      }
      
      console.log(`[${label}] Loaded ${results.length} result document(s)`);
      return results;
    }

    // 3. 各Processorの結果を取得
    const layoutDocs = await fetchProcessorResults(layoutDetails.outputGcsUriPrefix, 'Layout Parser');
    const ocrDocs = hasOcrResult ? await fetchProcessorResults(ocrDetails.outputGcsUriPrefix, 'Standard OCR') : null;
    
    if (!layoutDocs || layoutDocs.length === 0) {
      throw new Error('Layout Parser results not found');
    }
    
    console.log(`Processing ${layoutDocs.length} layout document(s), ${ocrDocs?.length || 0} OCR document(s)`);

    let fullExtractedText = "";
    let allOcrPages: any[] = [];
    let debugInfo = `Layout docs: ${layoutDocs.length}, OCR docs: ${ocrDocs?.length || 0}\n`;

    // Process Layout Parser results (primary source for structure and text)
    for (let i = 0; i < layoutDocs.length; i++) {
      const resultDoc = layoutDocs[i];
      const shardText = resultDoc.text || "";
      fullExtractedText += shardText;
      debugInfo += `\nLayout Shard ${i}: keys=[${Object.keys(resultDoc).join(", ")}], textLen=${shardText.length}`;

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
        console.log("Detected Layout Parser format (Case B)");
        const blocks = resultDoc.documentLayout.blocks;
        
        // デバッグ: 最初のブロックの構造を詳細に出力
        if (blocks.length > 0) {
          console.log("=== FIRST BLOCK STRUCTURE ===");
          console.log(JSON.stringify(blocks[0], null, 2));
          console.log("=== END FIRST BLOCK ===");
        }
        
        // 実際のページサイズ取得を試行
        let width = 1000;
        let height = 1000;
        if (resultDoc.pages && resultDoc.pages.length > 0) {
          width = resultDoc.pages[0].dimension?.width || 1000;
          height = resultDoc.pages[0].dimension?.height || 1000;
          console.log(`Using page dimension: ${width}x${height}`);
        }
        
        // テキスト抽出
        if (!shardText && blocks.length > 0) {
          fullExtractedText += extractTextFromBlocksRecursive(blocks).trim();
        }
        
        // ページごとにブロックをグルーピング
        const pagesMap = new Map<number, any[]>();
        processBlocksRecursive(blocks, width, height, pagesMap);
        
        shardPages = Array.from(pagesMap.entries()).map(([pageNum, blocks]) => ({
          page_number: pageNum,
          dimensions: { width, height },
          blocks
        })).sort((a, b) => a.page_number - b.page_number);

        console.log(`Extracted ${shardPages.length} pages from Layout Parser blocks.`);
      }
      
      allOcrPages = allOcrPages.concat(shardPages);
    }

    // Standard OCRの結果から座標情報を抽出してマージ
    if (ocrDocs && ocrDocs.length > 0) {
      console.log('=== Merging Standard OCR coordinates ===');
      
      // Standard OCRから座標マップを作成 (Key: "pageNum:normalizedText")
      const coordinateMap = new Map<string, { quadPoints: number[] }>();
      
      // テキスト正規化関数（空白や特殊文字を除去）
      const normalize = (s: string) => s.replace(/[\s\u3000\t\n\r]/g, '').toLowerCase();

      for (const ocrDoc of ocrDocs) {
        if (ocrDoc.pages && ocrDoc.pages.length > 0) {
          for (const page of ocrDoc.pages) {
            const { width, height } = page.dimension || { width: 1000, height: 1000 };
            const pageNumber = page.pageNumber || 1;
            
            for (const block of page.blocks || []) {
              const text = (ocrDoc.text || '').substring(
                block.layout?.textAnchor?.textSegments?.[0]?.startIndex || 0,
                block.layout?.textAnchor?.textSegments?.[0]?.endIndex || 0
              ).trim();
              
              const vertices = block.layout?.boundingPoly?.normalizedVertices;
              if (text && vertices && vertices.length >= 4) {
                const quadPoints = convertToQuadPoints(vertices, width, height);
                const normKey = normalize(text).substring(0, 100);
                if (normKey) {
                  // ページ番号をキーに含める
                  coordinateMap.set(`${pageNumber}:${normKey}`, { quadPoints });
                }
              }
            }
          }
        }
      }
      
      console.log(`Built coordinate map with ${coordinateMap.size} entries cross pages`);
      
      // Layout Parserの結果に座標を統合
      let enrichedCount = 0;
      let totalBlocks = 0;

      for (const page of allOcrPages) {
        let pageEnriched = 0;
        let pageBlocks = 0;
        
        for (const block of page.blocks || []) {
          totalBlocks++;
          pageBlocks++;
          // 既に座標がある場合はスキップ
          if (block.quadPoints && block.quadPoints.some((v: number) => v !== 0)) {
            continue;
          }
          
          const text = (block.text || '').trim();
          if (!text) continue;

          const normKey = normalize(text).substring(0, 100);
          const pageNum = page.page_number;
          
          // 同じページから優先的に検索
          let coordData = coordinateMap.get(`${pageNum}:${normKey}`);

          // フォールバック: 全ページから検索（一意の可能性にかけて）
          if (!coordData) {
            for (const [mCompositeKey, mData] of coordinateMap.entries()) {
              const [mPageStr, ...mTextParts] = mCompositeKey.split(':');
              const mText = mTextParts.join(':');
              if (mText.includes(normKey) || normKey.includes(mText)) {
                coordData = mData;
                // もしページが一致していればそれが最善
                if (parseInt(mPageStr) === pageNum) break; 
              }
            }
          }
          
          if (coordData) {
            block.quadPoints = coordData.quadPoints;
            enrichedCount++;
            pageEnriched++;
          } else {
            if (enrichedCount < 30) { 
              console.log(`[Merge] Match failed P${pageNum}: "${text.substring(0, 20)}..."`);
            }
          }
        }
        console.log(`Page ${page.page_number}: Enriched ${pageEnriched}/${pageBlocks} blocks`);
      }
      
      console.log(`Merge complete: Total Enriched ${enrichedCount}/${totalBlocks} blocks`);
    }

    // 各ブロックにページ番号を直接持たせ、RAG検索時に参照しやすくする
    for (const page of allOcrPages) {
      if (page.blocks) {
        for (const block of page.blocks) {
          block.page_number = page.page_number;
        }
      }
    }

    // RAG検索用のフラットな構造を作成 (座標情報を除外してトークン節約)
    const flattenedSearchIndex = allOcrPages.flatMap(p => 
      (p.blocks || []).map(b => ({
        text: b.text,
        page_number: p.page_number
        // quadPointsは送信しないため含めない
      }))
    );

    // If still empty text, put debug info into ocr_text
    const finalOcrText = fullExtractedText || `DEBUG: No text found. ${debugInfo}`;
    const resultSummary = `Success: ${allOcrPages.length} pages, ${flattenedSearchIndex.length} blocks extracted. Max Page: ${allOcrPages.length > 0 ? Math.max(...allOcrPages.map(p => p.page_number)) : 0}`;

    await supabase
      .from('documents')
      .update({
        ocr_text: resultSummary + "\n\n" + finalOcrText,
        ocr_pages: { pages: allOcrPages.slice(0, 250) },
        ocr_search_index: flattenedSearchIndex.slice(0, 3000),
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
