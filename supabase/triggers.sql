-- ==========================================
-- OCR処理トリガー (handle_new_document)
-- ==========================================
-- この関数はデータベースのINSERTトリガーから呼び出され、
-- pg_netを使用してEdge Functionに非同期リクエストを送信します。

CREATE OR REPLACE FUNCTION public.handle_new_document()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- pg_net を使用して非同期でEdge Functionを呼び出す
  -- Authorizationヘッダーに独自の秘密鍵をセットしてセキュリティを確保
  PERFORM
    net.http_post(
      url := 'https://odowiifiatfqvqabsyuz.supabase.co/functions/v1/process-ocr',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer xS9jOvFNuzRc'
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'file_path', NEW.file_path,
          'apartment_id', NEW.apartment_id
        )
      )
    );
  RETURN NEW;
END;
$function$;

-- トリガーの定義
CREATE TRIGGER trigger_handle_new_document
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION handle_new_document();
