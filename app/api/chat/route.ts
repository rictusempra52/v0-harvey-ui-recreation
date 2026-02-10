import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// モデルの動作を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたは、高齢者やPC・スマホ操作が苦手なユーザーをサポートする、親切で丁寧なAIアシスタント「シメスくん」です。
提供された「マンションの文書データ（コンテキスト）」に基づいて、ユーザーの質問に詳しく、かつ分かりやすく回答してください。

# 厳格に従うべきガイドライン
- **詳細かつ丁寧な解説**: 結論を簡潔に述べた後、その背景や詳細な内容を提供された資料に基づいて網羅的に説明してください。
- **分かりやすい構造化**: 箇条書きや段落を適切に使い、視覚的に理解しやすい形式で回答してください。
- **平易な言葉使い**: 法律用語や専門用語は避け、誰にでもわかる言葉に噛み砕いて説明してください。
- **安心感のあるトーン**: ユーザーの不安に寄り添い、丁寧で穏やかな口調を心がけてください。
- **資料の引用**: 根拠となる資料がある場合は、提供されたSourceID等を使用して正確に引用してください。資料にない情報は「記載がありません」と伝え、推測は避けてください。

# Markdown表示に関する、必ず守らなければならない最重要事項
- 見出し（###）や水平線（---）、リスト（*）の前後には必ず「空行」を入れてください。
- 強調したい単語は必ず二重のアスタリスク（例：**重要**）で囲んでください。
- 改行が必要な場合は、空行（二重改行）を適切に使用してください。
`;

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] --- Chat API Request Received ---`);
    
    const { messages, sessionId } = await req.json();
    console.log(`[${now}] Messages count:`, messages.length, "Session ID:", sessionId);

    let context = "";
    let apartmentName = "";

    // sessionIdがある場合、マンションに関連する文書を取得
    if (sessionId) {
      const supabase = await createServerSupabaseClient();
      
      // 1. セッションからマンションIDを取得
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('apartment_id, apartments(name)')
        .eq('id', sessionId)
        .single();

      if (session?.apartment_id) {
        // @ts-ignore
        apartmentName = session.apartments?.name || "";
        
        // 2. マンションに関連する文書を取得 (新カラム ocr_search_index を使用)
        const { data: docs } = await supabase
          .from('documents')
          .select('id, file_name, ocr_search_index')
          .eq('apartment_id', session.apartment_id)
          .not('ocr_search_index', 'is', null);

        if (docs && docs.length > 0) {
          context = docs.map(d => {
            const index = (d.ocr_search_index as any[]) || [];
            // AIが引用しやすいよう、各ブロックの先頭にIDとタイトル、ページ情報を埋め込む
            const structuredText = index.map((item, i) => 
              `[SourceID: ${d.id}, Page: ${item.page_number}, Block: ${i}]: ${item.text}`
            ).join('\n');
            
            return `--- Document Title: ${d.file_name} ---\n${structuredText}`;
          }).join('\n\n');
          console.log(`[${now}] Integrated context loaded from ${docs.length} documents`);
        }
      }
    }

    const fullSystemPrompt = `${SYSTEM_PROMPT}

【現在のマンション】
${apartmentName || '未指定'}

【マンションの文書データ（コンテキスト）】
${context || '提供された文書はありません。'}

【最重要：引用ルール】
回答の中で情報を引用する場合は、提供されたプレフィックス [SourceID: ..., Page: ..., Block: ...] を必ずそのまま引用元として明記してください。
また、回答の最後には、必ず「参考資料:」という見出しを付け、以下の形式でリストアップしてください。

参考資料:
* [文書のタイトル] (SourceID: 実際のID, Page: ページ番号, Block: ブロックID)
`;

    const result = streamText({
      model: google('gemini-2.0-flash-lite'),
      system: fullSystemPrompt,
      messages,
      onFinish({ usage }) {
        console.log(`[${now}] --- Stream Finished ---`);
        console.log(`[${now}] Usage:`, usage);
      },
    });

    console.log(`[${now}] Stream initiated successfully`);
    return result.toTextStreamResponse({
      headers: {
        'X-Chat-API-Status': 'success',
      },
    });
  } catch (error) {
    const now = new Date().toLocaleTimeString();
    console.error(`[${now}] --- Chat API Error ---`);
    console.error(error);

    // Do not expose internal error details or stack traces to the client.
    // Return a generic error response while logging full details on the server.
    const errorBody = {
      message: 'Internal server error',
    };

    return new Response(JSON.stringify({ error: errorBody }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
