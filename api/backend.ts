import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  maxDuration: 30,
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. טיפול ב-CORS Preflight
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const action = (req.query.action as string) || "";
  const force = req.query.force === "true";

  // כתובת ה-Apps Script והטוקן ממשתני הסביבה (עם ערכי ברירת מחדל)
  const APPS_SCRIPT_URL =
    process.env.GAS_URL ||
    "https://script.google.com/macros/s/AKfycbxVFYZsqxGmZsez91TUoii1LM8PALQmtuZebmPU2RK2Ki3ZuZADLGF_8u4OQ5rr4dSigQ/exec";
  const API_TOKEN = process.env.API_TOKEN || "openssl _1a084c2a6b9ed55a";

  try {
    // 2. פעולת אימות ובריאות
    if (action === "health") {
      const pingUrl = new URL(APPS_SCRIPT_URL);
      pingUrl.searchParams.set("action", "health");
      pingUrl.searchParams.set("token", API_TOKEN);

      try {
        const pingRes = await fetch(pingUrl.toString(), { redirect: "follow" });
        const pingJson = await pingRes.json();
        return res.status(200).json({ ok: true, healthy: true, serverData: pingJson });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(200).json({
          ok: true,
          healthy: false,
          error: "כשל בפנייה ל-Apps Script: " + message,
        });
      }
    }

    // 3. ניקוי Cache
    if (action === "clear-cache") {
      return res.status(200).json({ ok: true, message: "הזיכרון הזמני נוקה בהצלחה" });
    }

    // 4. שליפת תמונת דיסקית
    if (action === "image") {
      const link = (req.query.link as string) || (req.query.url as string) || "";
      if (!link) {
        return res.status(400).json({ ok: false, error: "חסר קישור לדיסקית" });
      }

      const imgUrl = new URL(APPS_SCRIPT_URL);
      imgUrl.searchParams.set("action", "image");
      imgUrl.searchParams.set("token", API_TOKEN);
      imgUrl.searchParams.set("url", link);

      const imgRes = await fetch(imgUrl.toString(), { redirect: "follow" });
      const imgData = await imgRes.json();
      return res.status(200).json(imgData);
    }

    // 5. שמירת תיקון / אישור דיסקית (POST)
    if (req.method === "POST" && req.body?.action === "saveDisc") {
      const saveRes = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: JSON.stringify({
          action: "saveDisc",
          token: API_TOKEN,
          row: req.body.row,
          fix: req.body.fix,
        }),
      });
      const saveJson = await saveRes.json();
      return res.status(200).json(saveJson);
    }

    // 6. פעולת Bootstrap ראשית - שליפה ישירה מה-Apps Script
    const targetUrl = new URL(APPS_SCRIPT_URL);
    targetUrl.searchParams.set("action", "bootstrap");
    targetUrl.searchParams.set("token", API_TOKEN);

    const startTime = Date.now();
    const sheetRes = await fetch(targetUrl.toString(), {
      redirect: "follow",
      headers: { Accept: "application/json" },
    });

    const contentType = sheetRes.headers.get("content-type") || "";
    const rawText = await sheetRes.text();
    const responseTimeMs = Date.now() - startTime;

    // בדיקה האם השרת של גוגל החזיר JSON ולא דף התחברות של Google (HTML)
    if (
      contentType.includes("application/json") ||
      (rawText.startsWith("{") && rawText.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.ok && parsed.data) {
          return res.status(200).json({
            ok: true,
            data: {
              discs: parsed.data.discs || [],
              visits: parsed.data.visits || [],
              sites: parsed.data.sites || [],
              cities: parsed.data.cities || [],
              deliveryNotes: parsed.data.deliveryNotes || [],
              anomalies: [],
              user: parsed.data.user || { name: "ראמי מסארווה", role: "סדרן עבודה ואיש שטח" },
              diagnosis: {
                ok: true,
                isUsingFallback: false,
                appsScriptHost: targetUrl.host,
                httpStatus: sheetRes.status,
                responseTimeMs,
                rowsCount: {
                  discs: (parsed.data.discs || []).length,
                  visits: (parsed.data.visits || []).length,
                  sites: (parsed.data.sites || []).length,
                  cities: (parsed.data.cities || []).length,
                },
                lastSyncTime: new Date().toLocaleTimeString("he-IL"),
              },
            },
          });
        }
      } catch (e) {
        // המשיכו למטה לקבלת אבחון
      }
    }

    // אם התקבל HTML או שגיאה מגוגל - נחזיר 200 עם אבחון ולא קריסת 500
    return res.status(200).json({
      ok: true,
      data: {
        discs: [],
        visits: [],
        sites: [],
        cities: [],
        deliveryNotes: [],
        anomalies: [],
        user: { name: "ראמי מסארווה", role: "סדרן עבודה ואיש שטח" },
        diagnosis: {
          ok: false,
          isUsingFallback: true,
          appsScriptHost: targetUrl.host,
          httpStatus: sheetRes.status,
          contentType,
          first200Chars: rawText.slice(0, 200),
          responseTimeMs,
          error: "שרת גוגל החזיר HTML במקום JSON (כנראה נדרשת הרשאת Anyone בפריסה).",
          causes: [
            "ודא שבהגדרות הפריסה ב-Apps Script (Deploy > Manage deployments) הגישה מוגדרת ל-Anyone ולא ל-Only myself.",
            "בדוק שהטוקן תואם לערך API_TOKEN ב-Script Properties.",
          ],
        },
      },
    });
  } catch (err: unknown) {
    // מניעת קריסת Serverless - תמיד מחזירים 200 עם תיאור התקלה
    const message = err instanceof Error ? err.message : String(err);
    return res.status(200).json({
      ok: true,
      data: {
        discs: [],
        visits: [],
        sites: [],
        cities: [],
        deliveryNotes: [],
        anomalies: [],
        user: { name: "ראמי מסארווה", role: "סדרן עבודה ואיש שטח" },
        diagnosis: {
          ok: false,
          isUsingFallback: true,
          error: "שגיאת שרת: " + message,
          causes: ["בדוק את יומן הריצה (Function Logs) ב-Vercel Dashboard."],
        },
      },
    });
  }
}
