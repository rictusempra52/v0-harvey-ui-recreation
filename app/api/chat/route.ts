import { google } from '@ai-sdk/google';
import { streamObject, streamText } from 'ai';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

// ... (以下、SYSTEM_PROMPT, chatResponseSchema, maxDuration はそのまま)

// モデルの動作を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたは、高齢者やPC・スマホ操作が苦手なユーザーをサポートする、親切で寄り添うAIアシスタント「シメスくん」です。
提供された「マンションの文書データ（コンテキスト）」の内容を読み解き、ユーザーの質問に対して、具体的に情報を補足しながら、指定された形式で回答を作成してください。

# 守るべき基本姿勢
- **予告で終わらせない**: 「〜について説明します」と言って終わるのではなく、具体的な内容（中身）まで全て書き切ってください。

# 回答のルール
- 回答本文 (\`answer\`) には、専門用語を避けた平易で温かい言葉（中学生でもわかる表現）を使用してください。
- 根拠となる資料がある場合は、引用元として提供された SourceID, Page, Block の情報を \`sources\` 配列に含めてください。
- 読みやすさを考慮し、適宜改行や太字を使用して構成してください。
`;

// レスポンスの構造定義
const chatResponseSchema = z.object({
  answer: z.string().describe('高齢者向けの親切で詳細な回答本文（Markdown形式）'),
  sources: z.array(z.object({
    fileId: z.string().describe('文書のUUID'),
    page: z.string().optional().describe('ページ番号'),
    blockId: z.string().optional().describe('ブロック番号'),
    citation: z.string().optional().describe('引用した箇所の短い抜粋（任意）'),
    title: z.string().optional().describe('文書のタイトル（任意）')
  })).describe('回答の根拠となった資料のリスト')
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] --- Chat API Request Received (Structural) ---`);
  
  try {
    const { messages, sessionId } = await req.json();
    console.log(`[${now}] Messages count:`, messages?.length, "Session ID:", sessionId);

    let context = "";
    let apartmentName = "";

    if (sessionId) {
      const supabase = await createServerSupabaseClient();
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('apartment_id, apartments(name)')
        .eq('id', sessionId)
        .single();

      if (session?.apartment_id) {
        // @ts-ignore
        apartmentName = session.apartments?.name || "";
        
        const { data: docs } = await supabase
          .from('documents')
          .select('id, file_name, ocr_search_index')
          .eq('apartment_id', session.apartment_id)
          .not('ocr_search_index', 'is', null);

        if (docs && docs.length > 0) {
          context = docs.map(d => {
            const index = (d.ocr_search_index as any[]) || [];
            const structuredText = index.map((item, i) => 
              `[SourceID: ${d.id}, Page: ${item.page_number}, Block: ${i}]: ${item.text}`
            ).join('\n');
            
            return `==== Document: ${d.file_name} (ID: ${d.id}) ====\n${structuredText}\n====================`;
          }).join('\n\n');
          console.log(`[${now}] Context loaded: ${docs.length} documents`);
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

    console.log(`[${now}] Full System Prompt (first 200 chars):`, fullSystemPrompt.substring(0, 200));
    console.log(`[${now}] Messages (last one):`, messages[messages.length - 1]);

    console.log(`[${now}] Starting streamObject process...`);
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error(`[${now}] MISSING API KEY: GOOGLE_GENERATIVE_AI_API_KEY`);
    }

    try {
      const result = streamObject({
        model: google('gemini-1.5-flash'),
        system: fullSystemPrompt,
        messages,
        schema: chatResponseSchema,
        onFinish({ usage }) {
          console.log(`[${new Date().toLocaleTimeString()}] Stream Finished.`, usage);
        },
        onError(error) {
          console.error(`[${new Date().toLocaleTimeString()}] Stream Error:`, error);
        }
      });

      console.log(`[${now}] streamObject initiated. Returning fullStream response.`);
      return new Response(result.fullStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Chat-API-Status': 'success-fullstream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (streamInitError: any) {
      console.error(`[${now}] Failed to initialize streamObject:`, streamInitError);
      throw streamInitError; // 外部の catch ブロックで処理
    }
  } catch (error: any) {
    const errTime = new Date().toLocaleTimeString();
    console.error(`[${errTime}] --- Chat API Fatal Error ---`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      stack: error.stack,
      hint: 'Check if Google AI SDK and API key are valid.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
