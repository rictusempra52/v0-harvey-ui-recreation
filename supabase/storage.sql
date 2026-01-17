-- Storage バケットの作成
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);

-- ポリシーを有効化
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーによる参照を許可
CREATE POLICY "Allow authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'pdfs' );

-- 認証済みユーザーによるアップロードを許可
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'pdfs' );

-- 認証済みユーザーによる削除を許可（自分のアップロードしたもののみ、といった制限は今のところテーブル側で管理するため今回は単純に）
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'pdfs' );
