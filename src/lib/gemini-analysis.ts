import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { GeminiAnalysisResult, DeterministicAnomaly, VisitRecord } from "./types";

const analysisCache = new Map<string, GeminiAnalysisResult>();

export interface AnalyzeDiscInput {
  date: string;
  driverName: string;
  truckPlate: string;
  visits: VisitRecord[];
  anomalies: DeterministicAnomaly[];
  totalKm?: number;
  ptoHours: number;
  hasDiscImage?: boolean;
  discImageBase64?: string; // תמיכה בתמונת דיסקית ל-Vision
}

export interface DiscVisionResult {
  date?: string;
  truckPlate?: string;
  driverName?: string;
  kmStart?: number;
  kmEnd?: number;
  totalKm?: number;
  drivingHours?: string;
  workHours?: string;
  idleHours?: string;
  confidence?: number;
  notes?: string;
}

/**
 * פונקציית Vision לניתוח אוטומטי של תמונת דיסקית טכוגרף באמצעות Gemini 2.5 Flash
 */
export async function analyzeTachographDiscVision(
  imageBase64: string,
  mimeType = "image/jpeg",
): Promise<DiscVisionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("חסר מפתח GEMINI_API_KEY במאפייני הסקריפט.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `
    אתה מהנדס לוגיסטיקה ובקר טכוגרף מומחה בח. סבן חומרי בניין.
    לפניך סריקה של דיסקית טכוגרף עגולה (24 שעות).
    אנא נתח את התמונה וחלץ את הנתונים הבאים בפורמט JSON בלבד, ללא טקסט נוסף וללא מעטפות markdown:
    {
      "date": "תאריך הדיסקית אם מופיע (DD/MM/YYYY)",
      "truckPlate": "מספר רישוי רכב אם מופיע",
      "driverName": "שם הנהג אם מופיע",
      "kmStart": קילומטר פתיחה מספר שלם,
      "kmEnd": קילומטר סגירה מספר שלם,
      "totalKm": סה"כ קילומטרים ביום מספר שלם,
      "drivingHours": "שעות נסיעה בפורמט HH:MM",
      "workHours": "שעות עבודה בפורמט HH:MM",
      "idleHours": "שעות סרק בפורמט HH:MM",
      "confidence": רמת ביטחון במספר עשרוני מ-0 עד 1,
      "notes": "הערות מיוחדות או שריטות מחט חריגות שנצפו בדיסקית"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Gemini Vision analysis error:", err);
    throw new Error("שגיאה בפענוח חזותי של הדיסקית: " + String(err));
  }
}

/**
 * פונקציית ניתוח יום ראשית (טקסטואלית + Vision משולב)
 */
export async function analyzeDayWithGemini(input: AnalyzeDiscInput): Promise<GeminiAnalysisResult> {
  const hashKey = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        date: input.date,
        driver: input.driverName,
        plate: input.truckPlate,
        visitsCount: input.visits.length,
        anomaliesCount: input.anomalies.length,
        pto: input.ptoHours,
        hasImage: Boolean(input.discImageBase64),
        anomalies: input.anomalies.map((a) => a.id),
      }),
    )
    .digest("hex");

  if (analysisCache.has(hashKey)) {
    return analysisCache.get(hashKey)!;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const rowsCount = input.visits.reduce((acc, v) => acc + v.notesCount, 0);

  // אם הועברה תמונה וקיים מפתח API, נפעיל ניתוח Vision מקדים ונשלב את התוצאות
  let visionData: DiscVisionResult | null = null;
  if (apiKey && input.discImageBase64) {
    try {
      visionData = await analyzeTachographDiscVision(input.discImageBase64);
    } catch (vErr) {
      console.warn("Vision auto-analysis skipped due to error:", vErr);
    }
  }

  if (!apiKey) {
    const defaultResult: GeminiAnalysisResult = {
      title: `דוח סיכום יומי: ${input.driverName} (${input.date})`,
      summary: `ביום זה בוצעו ${input.visits.length} ביקורים ב-${input.visits .map((v) => v.city) .filter((c, i, a) => a.indexOf(c) === i) .join(", ")}. זמן עבודת מנוף שנמדד עומד על ${input.ptoHours} שעות. זוהו ${input.anomalies.length} חריגות המחייבות בקרה.${
        visionData ? ` פוענחו נתוני דיסקית חזותיים (ק"מ משוער: ${visionData.totalKm ?? "לא ידוע"}).` : ""
      }`,
      priorities:
        input.anomalies.length > 0
          ? input.anomalies.map(
              (a) => `[${a.severity === "critical" ? "קריטי" : "אזהרה"}] ${a.title}:${a.evidence}`,
            )
          : ["היום עבר ללא חריגות תפעוליות או פערי זמנים."],
      driverQuestions:
        input.anomalies.length > 0
          ? input.anomalies.slice(0, 3).map((a) => `הסבר לגבי: ${a.title} (${a.evidence})`)
          : ["היום תקין - אין שאלות לבירור מול הנהג."],
      createdAt: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      basedOnRows: rowsCount,
      isVisualEstimate: Boolean(input.hasDiscImage || visionData),
    };
    analysisCache.set(hashKey, defaultResult);
    return defaultResult;
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `אתה מערכת בקרת לוגיסטיקה חכמה של ח. סבן חומרי בניין (1994) בע״מ.
עליך לנתח עובדות, נתוני Vision של דיסקית וחריגות מחושבות של יום עבודה ולספק סיכום מובנה, תמציתי ומדויק בעברית.
כלל ברזל:
1. אל תמציא מספרים, אירועים או שעות שלא סופקו לך. צטט אך ורק מהנתונים שניתנו.
2. כשנתון חסר, ציין במפורש "אין נתון".
3. הפלט חייב להיות בפורמט JSON בלבד.`;

  const payloadText = JSON.stringify({
    date: input.date,
    driver: input.driverName,
    truck: input.truckPlate,
    totalVisits: input.visits.length,
    ptoHours: input.ptoHours,
    totalKm: input.totalKm ?? "אין נתון",
    visionExtractedData: visionData || "לא צורפה תמונה לניתוח Vision",
    visits: input.visits.map((v) => ({
      address: v.address,
      city: v.city,
      ituranArrival: v.ituranArrival ?? "אין נתון",
      ituranDeparture: v.ituranDeparture ?? "אין נתון",
      ptoMinutes: v.ptoMinutes ?? "אין נתון",
      handwrittenWindow: v.handwrittenCraneWindow ?? "אין נתון",
      notesCount: v.notesCount,
      signature: v.customerSignature,
    })),
    deterministicAnomalies: input.anomalies.map((a) => ({
      type: a.type,
      severity: a.severity,
      title: a.title,
      evidence: a.evidence,
      explanation: a.explanation,
    })),
  });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `נתח את נתוני היום הבאים של הנהג ${input.driverName} מתאריך ${input.date}:${payloadText}

החזר אך ורק אובייקט JSON תקין (ללא markdown וללא תגיות \`\`\`json) במבנה הבא:
{
  "title": "כותרת קצרה וממצה",
  "summary": "סיכום יום מדויק בן 3 משפטים בלבד המציין את הפעילות והחריגות המרכזיות כולל נתוני הדיסקית אם קיימים",
  "priorities": ["רשימת חריגות לפי סדיר עדיפות לטיפול"],
  "driverQuestions": ["שאלות קונקרטיות לבירור מול הנהג לגבי הפערים"]
}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const cleanJson = text
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleanJson);

    const result: GeminiAnalysisResult = {
      title: parsed.title || `ניתוח יום: ${input.driverName} (${input.date})`,
      summary: parsed.summary || "סיכום פעילות יומית הושלם.",
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      driverQuestions: Array.isArray(parsed.driverQuestions) ? parsed.driverQuestions : [],
      createdAt: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      basedOnRows: rowsCount,
      isVisualEstimate: Boolean(input.hasDiscImage || visionData),
    };

    analysisCache.set(hashKey, result);
    return result;
  } catch (err) {
    console.error("Gemini analysis error:", err);
    const fallback: GeminiAnalysisResult = {
      title: `דוח בקרה: ${input.driverName} (${input.date})`,
      summary: `היום כלל ${input.visits.length} ביקורים וזמן PTO של ${input.ptoHours} שעות.${
        visionData ? ` ק"מ מדיסקית חזותית: ${visionData.totalKm ?? "לא פוענח"}.` : ""
      } קיימות ${input.anomalies.length} חריגות מחושבות.`,
      priorities: input.anomalies.map((a) => `[${a.severity}] ${a.title}: ${a.evidence}`),
      driverQuestions: input.anomalies.map((a) => `לברר מול הנהג: ${a.title}`),
      createdAt: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      basedOnRows: rowsCount,
      isVisualEstimate: Boolean(input.hasDiscImage || visionData),
    };
    return fallback;
  }
}