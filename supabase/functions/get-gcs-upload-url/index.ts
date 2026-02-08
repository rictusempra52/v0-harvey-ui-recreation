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
    const { fileName, contentType, apartmentId } = await req.json();

    if (!fileName || !apartmentId) {
      return new Response(JSON.stringify({ error: "fileName and apartmentId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Cloud Storage の設定
    const googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!googleJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const bucketName = Deno.env.get("GCS_BUCKET_NAME") || "v0-harvey-docs";
    const credentials = JSON.parse(googleJson);

    const storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });

    const bucket = storage.bucket(bucketName);
    // パス構造: {apartmentId}/{timestamp}_{fileName}
    const filePath = `${apartmentId}/${Date.now()}_${fileName}`;
    const file = bucket.file(filePath);

    // 署名付きURLの発行 (PUT用, 15分有効)
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType || "application/pdf",
    });

    return new Response(
      JSON.stringify({
        uploadUrl: url,
        filePath: filePath,
        bucketName: bucketName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
