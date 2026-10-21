import { fetchBootstrapData, invalidateCache, saveDiscCorrection } from "./sheets-api";
import { analyzeDayWithGemini, analyzeTachographDiscVision } from "./gemini-analysis";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function handleBackendApiRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";

  // 1. Health check
  if (action === "health") {
    const data = await fetchBootstrapData(false);
    return Response.json(
      {
        ok: true,
        healthy: data.diagnosis.ok || data.diagnosis.isUsingFallback,
        diagnosis: data.diagnosis,
        time: new Date().toISOString(),
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  // 2. Clear cache
  if (action === "clear-cache" || url.pathname.endsWith("/clear-cache")) {
    invalidateCache();
    const freshData = await fetchBootstrapData(true);
    return Response.json(
      { ok: true, message: "הזיכרון הזמני נוקה בהצלחה 🔄", diagnosis: freshData.diagnosis },
      { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  // 3. AI Analysis (Text / Day Summary)
  if (url.pathname.includes("/api/ai/analyze-disc") || action === "analyze-disc") {
    if (method !== "POST") {
      return Response.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await request.json();
      const analysis = await analyzeDayWithGemini(body);
      return Response.json(
        { ok: true, data: analysis },
        { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
      );
    } catch (err) {
      return Response.json(
        { ok: false, error: "שגיאה בניתוח AI: " + String(err) },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // 3.1 NEW: Vision Analysis Endpoint for Tachograph Discs
  if (action === "analyze-vision" || url.pathname.includes("/api/ai/analyze-vision")) {
    if (method !== "POST") {
      return Response.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = await request.json();
      const { imageBase64, mimeType } = body;
      if (!imageBase64) {
        return Response.json({ ok: false, error: "חסר נתון תמונה (imageBase64)" }, { status: 400 });
      }
      const visionResult = await analyzeTachographDiscVision(imageBase64, mimeType || "image/jpeg");
      return Response.json(
        { ok: true, data: visionResult },
        { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
      );
    } catch (err) {
      return Response.json(
        { ok: false, error: "שגיאה בפענוח Vision: " + String(err) },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // 4. Save disc correction (POST)
  if (method === "POST") {
    try {
      const body = await request.json();
      if (body.action === "saveDisc") {
        const result = await saveDiscCorrection(body.row, body.fix || {});
        return Response.json(result, {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }
    } catch (err) {
      return Response.json(
        { ok: false, error: "שגיאה בפענוח בקשת שמירה: " + String(err) },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  // 5. Image proxy (action=image)
  if (action === "image") {
    const link = url.searchParams.get("link") || url.searchParams.get("url") || "";
    if (!link) {
      return Response.json({ ok: false, error: "חסר קישור לתמונה" }, { status: 400 });
    }
    return Response.json(
      { ok: true, link, message: "תמונה מאומתת" },
      { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  // 6. Default: Bootstrap data
  const force = url.searchParams.get("force") === "true";
  try {
    const bootstrap = await fetchBootstrapData(force);
    return Response.json(
      { ok: true, data: bootstrap },
      { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: "שגיאה בטעינת נתונים: " + String(err) },
      { status: 500, headers: corsHeaders },
    );
  }
}