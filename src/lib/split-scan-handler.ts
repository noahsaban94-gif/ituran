import { PDFDocument } from "pdf-lib";

const MAX_BODY_SIZE = 4.5 * 1024 * 1024; // 4.5MB limit for Vercel serverless functions

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function extractPdfBuffer(buffer: Buffer): Buffer | null {
  const magic = Buffer.from("%PDF-");
  const startIdx = buffer.indexOf(magic);
  if (startIdx === -1) return null;

  const eofMagic = Buffer.from("%%EOF");
  const endIdx = buffer.lastIndexOf(eofMagic);
  if (endIdx === -1) {
    return buffer.subarray(startIdx);
  }

  return buffer.subarray(startIdx, endIdx + 5);
}

export async function handleSplitScanRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  // 1. Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 2. Handle GET health check
  if (method === "GET") {
    return Response.json(
      { ok: true, service: "split-scan" },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // 3. Only POST is allowed for splitting
  if (method !== "POST") {
    return Response.json(
      { ok: false, error: "Method Not Allowed" },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // 4. Security Check (SPLIT_SCAN_TOKEN if configured)
  const requiredToken = process.env.SPLIT_SCAN_TOKEN;
  if (requiredToken) {
    const providedApiKey = request.headers.get("x-api-key");
    if (!providedApiKey || providedApiKey !== requiredToken) {
      return Response.json(
        { ok: false, error: "טוקן אימות חסר או שגוי" },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    }
  }

  // 5. Size Check
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return Response.json(
      {
        ok: false,
        error:
          "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
      },
      {
        status: 413,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // 6. Read raw body and extract PDF
  let rawBuffer: Buffer;
  try {
    const arrayBuffer = await request.arrayBuffer();
    rawBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    return Response.json(
      { ok: false, error: "שגיאה בקריאת גוף הבקשה" },
      {
        status: 422,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (rawBuffer.length > MAX_BODY_SIZE) {
    return Response.json(
      {
        ok: false,
        error:
          "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
      },
      {
        status: 413,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  const pdfBuffer = extractPdfBuffer(rawBuffer);
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return Response.json(
      { ok: false, error: "הקובץ שנשלח אינו קובץ PDF תקין" },
      {
        status: 422,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // 7. Load PDF with pdf-lib and validate page count
  let srcDoc: PDFDocument;
  let totalPages = 0;
  try {
    srcDoc = await PDFDocument.load(pdfBuffer);
    totalPages = srcDoc.getPageCount();
  } catch {
    return Response.json(
      { ok: false, error: "שגיאה בפענוח קובץ ה-PDF (קובץ פגום או לא קריא)" },
      {
        status: 422,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (totalPages < 3) {
    return Response.json(
      {
        ok: false,
        error:
          "הקובץ מכיל פחות מ-3 עמודים (נדרשים לפחות עמוד מניפסט, תעודת משלוח אחת ודיסקית טכוגרף)",
      },
      {
        status: 422,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // 8. Split Pages:
  // Pages 2 to N-1 (index 1 to totalPages - 2)
  const pages: string[] = [];
  for (let i = 1; i < totalPages - 1; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
    if (copiedPage) singleDoc.addPage(copiedPage);
    const singlePdfBytes = await singleDoc.save();
    pages.push(Buffer.from(singlePdfBytes).toString("base64"));
  }

  // Page N: Tachograph disc (index totalPages - 1)
  const tachographDoc = await PDFDocument.create();
  const [tachoPage] = await tachographDoc.copyPages(srcDoc, [totalPages - 1]);
  if (tachoPage) tachographDoc.addPage(tachoPage);
  const tachoPdfBytes = await tachographDoc.save();
  const tachograph_page = Buffer.from(tachoPdfBytes).toString("base64");

  return Response.json(
    {
      ok: true,
      page_count: totalPages,
      pages,
      tachograph_page,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
