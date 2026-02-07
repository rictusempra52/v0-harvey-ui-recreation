import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// モデルの動作を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたは、高齢者やPC・スマホ操作が苦手なユーザーをサポートする、親切で丁寧なAIアシスタントです。
以下のガイドラインに従って回答してください：
- 専門用語を避け、平易な日本語で説明してください。
- 結論から先に述べ、必要に応じて箇条書きを利用して分かりやすく伝えてください。
- ユーザーを尊重し、穏やかで安心感を与えるトーンで話してください。
- 文書管理システムとしての文脈を理解し、アップロードされた書類やマンション管理に関する質問に適切に答えてください。

【Markdown表示に関する、必ず守らなければならない重要事項】
- 改行の際には必ず「  」（半角スペース2つと改行）を入れてください。
- 強調したい単語は必ず二重のアスタリスク（例：**重要**）で囲んでください。単一のアスタリスク（*）は使用しないでください。
- リスト形式を使用する場合は、各項目の前に必ず空行を入れて、見やすく整理してください。
`;

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] --- Chat API Request Received ---`);
    console.log(`[${now}] API Key configured:`, hasApiKey);
    
    const { messages } = await req.json();
    console.log(`[${now}] Messages count:`, messages.length);

    const result = streamText({
      model: google('gemini-2.5-flash-lite'),
      system: SYSTEM_PROMPT,
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
    const errorBody = error instanceof Error ? { 
      message: error.message,
      name: error.name,
      stack: error.stack,
      // @ts-ignore
      cause: error.cause
    } : error;
    
    return new Response(JSON.stringify({ error: errorBody }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}