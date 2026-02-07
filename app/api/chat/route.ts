import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// モデルの動作を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたは、高齢者やPC・スマホ操作が苦手なユーザーをサポートする、親切で丁寧なAIアシスタント「シメスくん」です。
提供された「マンションの文書データ（コンテキスト）」に基づいて回答してください。

以下のガイドラインに従って回答してください：
- 専門用語を避け、平易な日本語で説明してください。
- 結論から先に述べ、必要に応じて箇条書きを利用して分かりやすく伝えてください。
- ユーザーを尊重し、穏やかで安心感を与えるトーンで話してください。
- 文献にない情報については「提供された資料には記載がありません」と答え、憶測で回答しないでください。

【引用と根拠の提示について】
- 回答の根拠となった文書がある場合は、文中で「〜によると（文書名）」のように言及してください。
- 回答の最後に、以下の形式で参照した文書のリストを必ず含めてください。
  参考資料:
  * [文書名] (ページ番号があれば)
- 文書名には、提供されたコンテキスト内のファイル名をそのまま使用してください。

【Markdown表示に関する、必ず守らなければならない最重要事項】
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
        
        // 2. マンションに関連する文書を取得
        const { data: docs } = await supabase
          .from('documents')
          .select('id, file_name, ocr_text')
          .eq('apartment_id', session.apartment_id)
          .not('ocr_text', 'is', null);

        if (docs && docs.length > 0) {
          context = docs.map(d => `--- Document ID: ${d.id}, Title: ${d.file_name} ---\n${d.ocr_text}`).join('\n\n');
          console.log(`[${now}] Context loaded from ${docs.length} documents for ${apartmentName}`);
        }
      }
    }

    const fullSystemPrompt = `${SYSTEM_PROMPT}

【現在のマンション】
${apartmentName || '未指定'}

【マンションの文書データ（コンテキスト）】
${context || '提供された文書はありません。一般的な知識で答えず、文書がない旨を伝えてください。'}

【重要な指示：必ず守ること】
回答の最後には、必ず「参考資料:」という見出しを付け、以下の形式で「使用した全ての文書」をリストアップしてください。
IDは、コンテキスト内の Document ID を正確に記述してください。省略は厳禁です。

参考資料:
* [文書のタイトル] (ID: 実際のDocument ID)
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
