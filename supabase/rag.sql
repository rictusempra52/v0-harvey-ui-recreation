-- ==========================================
-- RAG (Retrieval-Augmented Generation) データベーススキーマ
-- ==========================================
-- 文書のチャンク分割とベクトル検索のための定義です。

-- 1. pgvector 拡張機能の有効化 (必須)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. document_chunks テーブル作成
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI / Gemini embedding dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. インデックス作成
-- ドキュメントIDによる検索の高速化
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- ベクトル類似度検索のためのHNSWインデックス (cosine distance)
-- 注: データ量が増えた後に作成することを推奨する場合もありますが、ここでは定義として記述
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 4. RLS ポリシー (必要に応じて設定)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全チャンクを参照可能 (検索用)
CREATE POLICY "Allow authenticated read document_chunks" ON document_chunks
  FOR SELECT TO authenticated USING (true);

-- 認証済みユーザーはチャンクを追加・削除可能 (管理者/Edge Function用)
CREATE POLICY "Allow authenticated insert document_chunks" ON document_chunks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated delete document_chunks" ON document_chunks
  FOR DELETE TO authenticated USING (true);


-- 5. 類似度検索関数 (match_document_chunks)
-- Supabase SDK (rpc) から呼び出して使用します。
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_apartment_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page_number int,
  similarity float,
  file_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.file_name
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.apartment_id = p_apartment_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
