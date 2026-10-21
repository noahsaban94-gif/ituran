import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  maxDuration: 60,
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
  const API_TOKEN = process.env.API_TOKEN || "saban_secure_token_2026";

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
          const rawSites: Record<string, unknown>[] = Array.isArray(parsed.data.sites)
            ? (parsed.data.sites as Record<string, unknown>[])
            : [];
          const rawCities: Record<string, unknown>[] = Array.isArray(parsed.data.cities)
            ? (parsed.data.cities as Record<string, unknown>[])
            : [];
          const rawVisits: Record<string, unknown>[] = Array.isArray(parsed.data.visits)
            ? (parsed.data.visits as Record<string, unknown>[])
            : [];
          const rawDiscs: Record<string, unknown>[] = Array.isArray(parsed.data.discs)
            ? (parsed.data.discs as Record<string, unknown>[])
            : [];
          const rawNotes: Record<string, unknown>[] = Array.isArray(parsed.data.deliveryNotes)
            ? (parsed.data.deliveryNotes as Record<string, unknown>[])
            : [];

          // נירמול אתרים למבנה תקני וחסין שגיאות
          const sites = rawSites.map((s, idx) => {
            const address = String(
              s?.address ||
                s?.["כתובת"] ||
                s?.["כתובת אספקה"] ||
                s?.["אתר"] ||
                s?.["כתובת ועיר"] ||
                "",
            ).trim();
            const city = String(s?.city || s?.["עיר"] || "").trim() || "אחר";
            let customers: string[] = [];
            if (Array.isArray(s?.customers)) {
              customers = s.customers.map((c: unknown) => String(c ?? "")).filter(Boolean);
            } else if (typeof s?.customers === "string") {
              customers = s.customers
                .split(",")
                .map((c: string) => c.trim())
                .filter(Boolean);
            } else if (typeof s?.["לקוחות באתר"] === "string") {
              customers = s["לקוחות באתר"]
                .split(",")
                .map((c: string) => c.trim())
                .filter(Boolean);
            } else if (typeof s?.["לקוחות"] === "string") {
              customers = s["לקוחות"]
                .split(",")
                .map((c: string) => c.trim())
                .filter(Boolean);
            } else if (typeof s?.["לקוח"] === "string") {
              customers = [s["לקוח"].trim()];
            } else if (typeof s?.["שם לקוח"] === "string") {
              customers = [s["שם לקוח"].trim()];
            }

            const visitCount = Number(s?.visitCount || s?.["ביקורים"] || 0);

            return {
              ...s,
              siteKey: String(
                s?.siteKey || s?.["מפתח אתר"] || `${city}|${address}` || `site-${idx}`,
              ),
              address: address || "כתובת לא צוינה",
              city,
              customers,
              visitCount,
              lastVisitDate: String(s?.lastVisitDate || s?.["תאריך אחרון"] || ""),
              measurementCount: Number(s?.measurementCount || s?.["מדידות"] || 0),
              medianSiteMinutes: Number(s?.medianSiteMinutes || s?.["חציון באתר"] || 0),
              p80SiteMinutes: Number(s?.p80SiteMinutes || s?.["P80 באתר"] || 0),
              maxSiteMinutes: Number(s?.maxSiteMinutes || s?.["מקס׳ באתר"] || 0),
              medianDriveMinutes: Number(s?.medianDriveMinutes || s?.["נסיעה (חציון)"] || 0),
              confidence:
                s?.confidence ||
                s?.["רמת ביטחון"] ||
                (visitCount >= 5 ? "גבוה" : visitCount >= 2 ? "בינוני" : "נמוך"),
            };
          });

          // נירמול ערים
          const cities = rawCities.map((c, idx) => ({
            ...c,
            city: String(c?.city || c?.["עיר"] || `עיר-${idx}`).trim(),
            visitCount: Number(c?.visitCount || c?.["ביקורים"] || 0),
            measurementCount: Number(c?.measurementCount || c?.["מדידות"] || 0),
            medianSiteMinutes: Number(c?.medianSiteMinutes || c?.["חציון באתר"] || 0),
            p80SiteMinutes: Number(c?.p80SiteMinutes || c?.["P80 באתר"] || 0),
            medianDriveMinutes: Number(c?.medianDriveMinutes || c?.["נסיעה (חציון)"] || 0),
          }));

          return res.status(200).json({
            ok: true,
            data: {
              discs: rawDiscs,
              visits: rawVisits,
              sites,
              cities,
              deliveryNotes: rawNotes,
              anomalies: [],
              user: parsed.data.user || { name: "ראמי מסארווה", role: "סדרן עבודה ואיש שטח" },
              diagnosis: {
                ok: true,
                isUsingFallback: false,
                appsScriptHost: targetUrl.host,
                httpStatus: sheetRes.status,
                responseTimeMs,
                rowsCount: {
                  discs: rawDiscs.length,
                  visits: rawVisits.length,
                  sites: sites.length,
                  cities: cities.length,
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
