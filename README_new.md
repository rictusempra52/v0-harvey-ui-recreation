# シメスくん - マンション管理AIアシスタント

高齢者でも直感的に使えるインターフェースを備えた、マンション管理支援ツールです。マンション管理規約や議事録をAIが解析し、住民の質問に対して迅速かつ正確な回答を提供します。

## 🎯 主な機能

- **ドキュメント管理**: 管理規約や議事録（PDF）をアップロード・管理
- **AIチャット**: 規約に基づいた質疑応答。マルチターン会話に対応
- **引用元表示**: 回答の根拠となるPDFの該当箇所を自動でハイライト表示
- **高齢者向けUI**: PC・スマホ操作が苦手な方でも迷わない、見やすく大きなボタン・フォント・高コントラスト設計
- **マンション選択**: 複数のマンション・アパートを管理可能
- **チャット履歴**: 過去の会話内容を保存・検索可能

## 🛠️ 技術スタック

### Frontend
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4.1.9, Radix UI Components (shadcn/ui)
- **Icon**: Lucide React
- **Form & Validation**: React Hook Form, Zod
- **State Management**: React Hooks, Custom Hooks
- **UI Components**: 
  - Resizable Panels (react-resizable-panels)
  - Markdown Rendering (react-markdown, remark-gfm)
  - Notifications (sonner)
  - Charts (recharts)

### Backend & Data
- **Backend**: Supabase (Database, Storage, Edge Functions)
- **Database**: PostgreSQL (via Supabase)
- **Vector DB**: Supabase Vector (pgvector)
- **File Storage**: Google Cloud Storage (via Supabase Edge Functions)

### AI & APIs
- **LLM**: OpenAI API (`@ai-sdk/openai`)
- **Alternative LLM**: Google Gemini (`@ai-sdk/google`)
- **AI SDK**: Vercel AI SDK (v6.0.57+)
- **OCR**: Google Cloud Vision API

## 📁 プロジェクト構造

```
.
├── app/                          # Next.js App Router ページ
│   ├── page.tsx                  # メインチャットページ
│   ├── documents/page.tsx        # ドキュメント管理ページ
│   ├── login/page.tsx            # ログインページ
│   ├── api/                      # API Routes
│   │   ├── chat/route.ts         # AIチャットエンドポイント
│   │   └── test/route.ts         # テスト用エンドポイント
│   ├── layout.tsx                # レイアウトコンポーネント
│   ├── globals.css               # グローバルスタイル
│   └── next-env.d.ts             # Next.js環境型定義
│
├── components/                   # UIコンポーネント
│   ├── sidebar.tsx               # サイドバーナビゲーション
│   ├── mansion-selector.tsx      # マンション選択コンポーネント
│   ├── history-view.tsx          # チャット履歴表示
│   ├── right-pane.tsx            # 右ペイン（PDF表示）
│   ├── pdf-viewer.tsx            # PDFビューア
│   ├── pdf-uploader.tsx          # PDFアップロード機能
│   ├── markdown.tsx              # Markdown レンダリング
│   ├── theme-provider.tsx        # テーマ管理
│   └── ui/                       # 再利用可能なUIコンポーネント（shadcn/ui）
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       ├── alert-dialog.tsx
│       ├── checkbox.tsx
│       ├── label.tsx
│       ├── resizable.tsx
│       ├── scroll-area.tsx
│       └── table.tsx
│
├── hooks/                        # カスタムReactフック
│   ├── use-chat.ts               # チャット処理ロジック
│   ├── use-upload.ts             # PDF・ファイルアップロード
│   ├── use-apartments.ts         # マンション情報管理
│   └── use-view-url.ts           # ファイルURL取得
│
├── lib/                          # ユーティリティ・ライブラリ
│   ├── auth-context.tsx          # 認証コンテキスト
│   ├── supabase.ts               # Supabaseクライアント（Client）
│   ├── supabase-server.ts        # Supabaseクライアント（Server）
│   ├── database.types.ts         # データベース型定義
│   └── utils.ts                  # 汎用ユーティリティ関数
│
├── supabase/                     # Supabase設定・Edge Functions
│   ├── schema.sql                # データベーススキーマ定義
│   ├── storage.sql               # ストレージ設定
│   └── functions/                # Edge Functions
│       ├── delete-gcs-object/    # GCSファイル削除
│       ├── get-gcs-upload-url/   # GCSアップロードURL取得
│       ├── get-gcs-view-url/     # GCSファイルURL取得
│       └── process-ocr/          # Google Vision OCR処理
│
├── public/                       # 静的ファイル
├── styles/                       # グローバルスタイル
├── components.json               # shadcn/ui設定
├── next.config.mjs               # Next.js設定
├── tsconfig.json                 # TypeScript設定
├── tailwind.config.mjs           # Tailwind CSS設定
├── postcss.config.mjs            # PostCSS設定
└── package.json                  # 依存関係・スクリプト
```

## 🚀 セットアップガイド

### 前提条件
- Node.js 18+ 
- npm または yarn
- Supabase プロジェクト
- Google Cloud プロジェクト（OCR・GCS用）
- OpenAI API キー

### 環境変数の設定

`.env.local` ファイルを作成し、以下の項目を設定してください：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key

# Google Cloud
GCS_BUCKET_NAME=your_gcs_bucket
GCP_PROJECT_ID=your_gcp_project_id

# その他
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### インストール＆起動

```bash
# 依存関係をインストール
npm install

# Supabase Edge Functionsの依存関係をインストール（オプション）
cd supabase/functions && npm install && cd ../..

# 開発サーバーを起動
npm run dev

# ブラウザで確認
# http://localhost:3000
```

### ビルドと本番起動

```bash
# ビルド
npm run build

# 本番サーバーを起動
npm start
```

### Lintチェック

```bash
npm run lint
```

## 📚 主要コンポーネント説明

### ページコンポーネント

#### [app/page.tsx](app/page.tsx) - メインチャットページ
- マンション選択機能
- PDFアップロード
- チャットインターフェース
- リサイズ可能なレイアウト（左：サイドバー、中央：チャット、右：PDF表示）
- シナリオベースのクイック質問

#### [app/documents/page.tsx](app/documents/page.tsx) - ドキュメント管理
- アップロード済みPDFの一覧表示
- PDF削除機能
- メタデータ表示

#### [app/login/page.tsx](app/login/page.tsx) - ログインページ
- Supabase認証との連携

### UIコンポーネント

#### [components/history-view.tsx](components/history-view.tsx)
- チャット履歴の表示
- 会話の復元機能

#### [components/mansion-selector.tsx](components/mansion-selector.tsx)
- マンション・アパート選択ドロップダウン
- 切り替え機能

#### [components/pdf-viewer.tsx](components/pdf-viewer.tsx)
- PDFの表示と操作
- ページナビゲーション

#### [components/right-pane.tsx](components/right-pane.tsx)
- 右ペインのコンテンツ管理（PDF表示など）
- レスポンシブ対応

## 🔌 API エンドポイント

### POST /api/chat
AIチャットの処理

**Request Body:**
```json
{
  "message": "ユーザーのメッセージ",
  "apartment_id": "マンションID",
  "conversation_history": [
    {
      "role": "user",
      "content": "前のメッセージ"
    },
    {
      "role": "assistant",
      "content": "前の返答"
    }
  ]
}
```

**Response:**
```json
{
  "response": "AIからの回答",
  "sources": [
    {
      "title": "PDFのタイトル",
      "page": "2",
      "content": "抜粋テキスト",
      "annotations": [],
      "fileId": "ファイルID"
    }
  ]
}
```

### GET /api/test または POST /api/test
テスト用エンドポイント

## 🎨 デザイン特性（高齢者向け）

- **大きなフォント**: 16px以上の本文フォントサイズ
- **高コントラスト**: 背景と文字色の十分なコントラスト比
- **シンプルなレイアウト**: 必要な機能に絞った画面設計
- **大きなボタン**: タッチしやすいボタンサイズ（最小48×48px）
- **明確なナビゲーション**: サイドバーで機能を明確に表示
- **テーマ対応**: ダークモード・ライトモード切り替え

## 🔐 認証・セキュリティ

- Supabase認証を利用したユーザー管理
- Row Level Security (RLS) によるデータ保護
- API キーの環境変数管理
- サーバーサイドレンダリング（SSR）による機密情報の保護

## 📊 データフロー

```
User Input
    ↓
[Chat Component] → useChat Hook → /api/chat Endpoint
    ↓
[AI SDK] → OpenAI/Google API
    ↓
[Vector Search] → Supabase pgvector
    ↓
[PDF Data] → Highlight & Return Sources
    ↓
[Display Response] → User
```

## 🔧 Supabase Edge Functions

Edge Functions は Google Cloud Functions で稼働し、ファイル操作やOCR処理を担当します。

#### delete-gcs-object/
GCSからファイルを削除

#### get-gcs-upload-url/
GCSアップロードの署名済みURLを取得

#### get-gcs-view-url/
GCSファイルの表示用署名済みURLを取得

#### process-ocr/
Google Cloud Vision APIを使用してPDFのテキストを抽出

## 🧪 テスト

```bash
# Lintチェック
npm run lint

# ビルドテスト
npm run build
```

## 📦 依存関係

主要な依存関係：
- **Next.js** 16.1.6
- **React** 19.2.0
- **TypeScript** 5
- **Tailwind CSS** 4.1.9
- **Supabase** (@supabase/supabase-js, @supabase/ssr)
- **Vercel AI SDK** 6.0.57+
- **React Hook Form** 7.60.0
- **Zod** 3.25.76

詳細は [package.json](package.json) を参照してください。

## 📝 ライセンス

プライベートプロジェクト

## 👥 開発情報

このプロジェクトはv0（Vercel AI）とGitHub Copilotを活用して開発されています。
