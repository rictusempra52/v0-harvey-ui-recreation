-- ==========================================
-- マンション管理アシスタント データベーススキーマ
-- ==========================================
-- このSQLをSupabase SQL Editorで実行してください
-- ==========================================

-- ==========================================
-- 1. テーブル作成
-- ==========================================

-- マンション
CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PDFドキュメント
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- チャットセッション
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- チャットメッセージ
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- アノテーション
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  page_number INTEGER,
  annotation_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. インデックス作成（パフォーマンス向上）
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_documents_apartment_id ON documents(apartment_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_apartment_id ON chat_sessions(apartment_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_message_id ON annotations(message_id);

-- ==========================================
-- 3. Row Level Security (RLS) を有効化
-- ==========================================

ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. RLS ポリシー作成
-- ==========================================

-- apartments: 認証済みユーザーは全マンション参照・作成可能
CREATE POLICY "Allow authenticated read apartments" ON apartments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert apartments" ON apartments
  FOR INSERT TO authenticated WITH CHECK (true);

-- documents: 認証済みユーザーは全ドキュメント参照・操作可能
CREATE POLICY "Allow authenticated read documents" ON documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert documents" ON documents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update documents" ON documents
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete documents" ON documents
  FOR DELETE TO authenticated USING (true);

-- chat_sessions: ユーザーは自分のセッションのみ操作可能
CREATE POLICY "Users own chat sessions select" ON chat_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users own chat sessions insert" ON chat_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own chat sessions update" ON chat_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users own chat sessions delete" ON chat_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- chat_messages: ユーザーは自分のセッションのメッセージのみ操作可能
CREATE POLICY "Users own messages select" ON chat_messages
  FOR SELECT TO authenticated USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users own messages insert" ON chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

-- annotations: 認証済みユーザーは全アノテーション参照・操作可能
CREATE POLICY "Allow authenticated read annotations" ON annotations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert annotations" ON annotations
  FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- 5. updated_at 自動更新用トリガー
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apartments_updated_at
  BEFORE UPDATE ON apartments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 6. 初期データ（サンプルマンション）
-- ==========================================

INSERT INTO apartments (name, address) VALUES
  ('グランドハイツ代々木', '東京都渋谷区代々木1-1-1'),
  ('パークサイド恵比寿', '東京都渋谷区恵比寿2-2-2'),
  ('リバーサイド中目黒', '東京都目黒区中目黒3-3-3')
ON CONFLICT DO NOTHING;
