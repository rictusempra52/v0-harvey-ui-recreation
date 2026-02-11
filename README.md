# シメスくん - マンション管理AIアシスタント

高齢者でも直感的に使えるインターフェースを備えた、マンション管理支援ツールです。マンション管理規約や議事録をAIが解析し、住民の質問に対して迅速かつ正確な回答を提供します。

## 主な機能

- **ドキュメント管理**: 管理規約や議事録（PDF）をアップロード・管理。
- **AIチャット**: 規約に基づいた質疑応答。
- **引用元表示**: 回答の根拠となるPDFの該当箇所を自動でハイライト表示。
- **高齢者向けUI**: PC・スマホ操作が苦手な方でも迷わない、見やすく大きなボタン・フォント・高コントラスト設計。

## 技術スタック

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Radix UI (shadcn/ui)
- **Backend**: Supabase (Database, Storage, Edge Functions)
- **OCR**: Google Cloud Vision API
- **RAG**: OpenAI API / Supabase Vector (pgvector)

## セットアップ

### 環境変数の設定

`.env.local` ファイルを作成し、以下の項目を設定してください：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# その他の必要な環境変数
```

### 開発サーバーの起動

```bash
npm install
npm run dev
```

## プロジェクト構造

- `app/`: Next.js App Router ページコンポーネント
- `components/`: UIコンポーネント（高齢者向けデザイン重視）
- `hooks/`: カスタムフック（Chat、Uploadなど）
- `lib/`: 共通ライブラリ・型定義
- `supabase/`: データベーススキーマやEdge Functions
- `.agent/`: AIアシスタント用のルール設定およびワークフロー