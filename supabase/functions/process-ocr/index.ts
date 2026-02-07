import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface DocumentRecord {
  id: string;
  file_path: string;
  apartment_id: string;
}

Deno.serve(async (req: Request) => {
  try {
    const { record } = await req.json() as { record: DocumentRecord };
    
    if (!record || !record.file_path) {
      return new Response(JSON.stringify({ error: 'Invalid record data' }), { status: 400 });
    }

    // 1. Supabase Clientの初期化
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. OCRステータスを 'processing' に更新
    await supabase
      .from('documents')
      .update({ ocr_status: 'processing' })
      .eq('id', record.id);

    // 3. StorageからPDFを取得
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(record.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 4. OCR処理 (OpenAI Vision API)
    // ここでPDFを画像に変換するか、OpenAIにそのまま投げる（今回は概要設計に基づきAIへ）
    // ※ 実際の実装ではPDFページを画像化してOpenAIに投げる構成がより確実です
    
    // 仮の結果（実際はAIからのレスポンスを加工）
    const ocrResult = {
      text: "抽出されたテキスト（ダミー）",
      data: {
        pages: [
          {
            page_number: 1,
            dimensions: { width: 595, height: 841 },
            blocks: [
              {
                text: "抽出されたテキスト（ダミー）",
                quadPoints: [100, 700, 200, 700, 100, 680, 200, 680]
              }
            ]
          }
        ]
      }
    };

    // 5. DBを更新
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ocr_text: ocrResult.text,
        ocr_data: ocrResult.data,
        ocr_status: 'completed'
      })
      .eq('id', record.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('OCR Error:', error);
    // 失敗した場合はステータスを 'failed' に
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
});
