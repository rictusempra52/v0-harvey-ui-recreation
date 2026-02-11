import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Storage } from "npm:@google-cloud/storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      return new Response(JSON.stringify({ error: "filePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Cloud Storage の設定
    const googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!googleJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const bucketName = Deno.env.get("GCS_BUCKET_NAME") || "shimesukun-harvey";
    
    let rawGcsJson = googleJson;
    if (rawGcsJson && !rawGcsJson.trim().startsWith('{')) {
      try { rawGcsJson = atob(rawGcsJson.trim()); } catch (e) {}
    }
    const credentials = JSON.parse(rawGcsJson);

    const storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    // 署名付きURLの発行 (GET用, 1時間有効)
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return new Response(
      JSON.stringify({
        url: url,
        expiresIn: 3600,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
