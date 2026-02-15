# Backend Rules (バックエンド実装規則)

## Database (Supabase / SQL)

- **SQL Definition Persistence**:
  - データベースオブジェクト（テーブル、関数、トリガー、RLSポリシーなど）を作成・変更する場合、**必ず** ローカルのSQLファイル（例: `supabase/schema.sql`, `supabase/triggers.sql`, `supabase/functions.sql`）にも定義を保存してください。
  - ダッシュボードやSQLエディタでの直接実行のみで完結させることは禁止です（一時的なデータ確認や検証を除く）。
  - コードベースとデータベースの状態を常に同期させ、再現性を確保してください。
