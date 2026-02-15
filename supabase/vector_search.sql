-- ==========================================
-- ベクトル検索 (RAG) 導入用 SQL
-- ==========================================

-- 1. pgvector 拡張の有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ドキュメントチャンク保存用テーブル
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  page_number INTEGER,
  embedding vector(768), -- Gemini text-embedding-004 は 768次元
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. インデックスの作成 (パフォーマンス向上)
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
-- HNSWインデックス (コサイン類似度用)
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 4. 類似度検索用関数の作成 (RPCで呼び出し可能)
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_apartment_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  page_number INTEGER,
  similarity float,
  file_name TEXT
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
