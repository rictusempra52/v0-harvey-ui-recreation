import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// モデルの動作を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたは、高齢者やPC・スマホ操作が苦手なユーザーをサポートする、親切で丁寧なAIアシスタントです。
以下のガイドラインに従って回答してください：
- 専門用語を避け、平易な日本語で説明してください。
- 結論から先に述べ、必要に応じて箇条書きを利用して分かりやすく伝えてください。
- ユーザーを尊重し、穏やかで安心感を与えるトーンで話してください。
- 文書管理システムとしての文脈を理解し、アップロードされた書類やマンション管理に関する質問に適切に答えてください。
`;

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-1.5-flash'), // 高速でコスト効率の良いflashを使用。必要に応じてproに変更可能。
    system: SYSTEM_PROMPT,
    messages,
  });

  return result.toTextStreamResponse();
}