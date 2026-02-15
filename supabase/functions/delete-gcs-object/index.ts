import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Storage } from "npm:@google-cloud/storage";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { filePaths, prefixes } = await req.json();

    if ((!filePaths || !Array.isArray(filePaths)) && (!prefixes || !Array.isArray(prefixes))) {
      return new Response(JSON.stringify({ error: "filePaths or prefixes array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!googleJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

    const bucketName = Deno.env.get("GCS_BUCKET_NAME") || "v0-harvey-docs";
    
    let rawGcsJson = googleJson;
    if (rawGcsJson && !rawGcsJson.trim().startsWith('{')) {
      try { rawGcsJson = atob(rawGcsJson.trim()); } catch (e) {}
    }
    const credentials = JSON.parse(rawGcsJson);
    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const bucket = storage.bucket(bucketName);

    // Delete specific files
    if (filePaths && Array.isArray(filePaths) && filePaths.length > 0) {
      console.log(`Deleting files from GCS: ${filePaths.join(", ")}`);
      const deletePromises = filePaths.map(path => bucket.file(path).delete().catch(err => {
        console.warn(`Failed to delete ${path}: ${err.message}`);
        return null; // Ignore individual failures
      }));
      await Promise.all(deletePromises);
    }

    // Delete files by prefix (folder)
    if (prefixes && Array.isArray(prefixes) && prefixes.length > 0) {
      console.log(`Deleting prefixes from GCS: ${prefixes.join(", ")}`);
      const deletePrefixPromises = prefixes.map(prefix => bucket.deleteFiles({ prefix }).catch(err => {
        console.warn(`Failed to delete prefix ${prefix}: ${err.message}`);
        return null;
      }));
      await Promise.all(deletePrefixPromises);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting objects:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
