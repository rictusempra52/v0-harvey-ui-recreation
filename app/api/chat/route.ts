import { google } from '@ai-sdk/google';
import { streamObject } from 'ai';
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
        
        // 1. ユーザーの質問（最後のメッセージ）をベクトル化
        const lastMessage = messages[messages.length - 1]?.content || "";
        console.log(`[${now}] Vectorizing query: "${lastMessage.substring(0, 50)}..."`);
        
        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const embeddingRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text: lastMessage }] }
            })
          }
        );

        if (embeddingRes.ok) {
          const { embedding } = await embeddingRes.json();
          const queryVector = embedding.values;

          // 2. 類似チャンクを検索
          const { data: chunks, error: matchError } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryVector,
            match_threshold: 0.3, // 類似度の閾値
            match_count: 20,      // 上位20件
            p_apartment_id: session.apartment_id
          });

          if (matchError) {
            console.error(`[${now}] Vector search error:`, matchError);
          } else if (chunks && chunks.length > 0) {
            context = chunks.map((c: any) => 
              `[SourceID: ${c.document_id}, Page: ${c.page_number}, File: ${c.file_name}]: ${c.content}`
            ).join('\n\n');
            console.log(`[${now}] Context loaded via vector search: ${chunks.length} chunks`);
          } else {
            console.log(`[${now}] No relevant chunks found for the query.`);
          }
        } else {
          console.error(`[${now}] Failed to generate query embedding:`, await embeddingRes.text());
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

    console.log(`[${now}] Starting streamObject with native JSON mode...`);
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    console.log(`[${now}] Verifying Google Generative AI configuration...`);

    // Gemini は空の content を嫌うためフィルタリング
    const validMessages = messages.filter((m: any) => m.content && m.content.trim() !== "");

    try {
      const result = await streamObject({
        model: google('gemini-2.0-flash'),
        system: fullSystemPrompt,
        messages: validMessages,
        schema: chatResponseSchema,
        onFinish({ usage }) {
          console.log(`[${new Date().toLocaleTimeString()}] Stream Finished.`, usage);
        },
      });

      // Data Stream Protocol (v1) を手動で実装して送信する
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // fullStream を iteration してチャンクを処理
            for await (const part of result.fullStream) {
              // ログ出力（デバッグ用）
              console.log(`[${new Date().toLocaleTimeString()}] --- Stream Part --- Type: ${part.type}`);

              const p = part as any;
              if (p.type === 'object-delta') {
                // streamObject の場合、JSONの断片は object-delta として来る
                // クライアント側の既存ロジックに合わせて '0:' prefix で送る
                // 注意: p.objectDelta はオブジェクトの断片なので、文字列化して送る
                const chunk = `0:${JSON.stringify(JSON.stringify(p.objectDelta))}\n`;
                controller.enqueue(encoder.encode(chunk));
              } else if (p.type === 'text-delta') {
                // フォールバック
                const chunk = `0:${JSON.stringify(p.textDelta)}\n`;
                controller.enqueue(encoder.encode(chunk));
              }
            }
            // 終了メタデータを送信
            controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
            controller.close();
          } catch (error) {
            console.error('Stream processing error:', error);
            controller.enqueue(encoder.encode(`e:${JSON.stringify(error)}\n`));
            controller.close();
          }
        }
      });

      console.log(`[${now}] Custom Data Stream initiated via streamObject. Returning Response.`);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Chat-API-Status': 'success-stream-object',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (streamError: any) {
      console.error(`[${now}] Failed to initialize streamObject:`, streamError);
      throw streamError;
    }
  } catch (error: any) {
    const errTime = new Date().toLocaleTimeString();
    console.error(`[${errTime}] --- Chat API Fatal Error ---`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error',
      hint: 'Check Google AI SDK, API key, and model availability.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
