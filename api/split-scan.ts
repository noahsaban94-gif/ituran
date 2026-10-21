import { PDFDocument } from "pdf-lib";

const MAX_BODY_SIZE = 4.5 * 1024 * 1024; // 4.5MB Vercel Serverless limit

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res?: any) {
  // If Web standard Request environment (Edge or fetch)
  if (!res && typeof req?.headers?.get === "function") {
    return handleWebRequest(req as Request);
  }

  // Node.js Serverless Function environment (Vercel)
  try {
    const method = (req.method || "GET").toUpperCase();

    // 1. CORS Preflight
    if (method === "OPTIONS") {
      res.statusCode = 204;
      for (const [k, v] of Object.entries(corsHeaders)) {
        res.setHeader(k, v);
      }
      return res.end();
    }

    // Set CORS on all responses
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.setHeader(k, v);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    // 2. Health check (GET)
    if (method === "GET") {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, service: "split-scan" }));
    }

    if (method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
    }

    // 3. Security Check
    const requiredToken = process.env.SPLIT_SCAN_TOKEN;
    if (requiredToken) {
      const apiKey = req.headers?.["x-api-key"];
      if (!apiKey || apiKey !== requiredToken) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: "טוקן אימות חסר או שגוי" }));
      }
    }

    // 4. Content size check from headers
    const contentLength = req.headers?.["content-length"];
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      res.statusCode = 413;
      return res.end(
        JSON.stringify({
          ok: false,
          error:
            "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
        }),
      );
    }

    // 5. Read Body Chunks
    let rawBuffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBuffer = req.body;
    } else if (typeof req.body === "string") {
      rawBuffer = Buffer.from(req.body, "utf-8");
    } else if (req.body && typeof req.body === "object" && Buffer.isBuffer(req.body.file)) {
      rawBuffer = req.body.file;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      rawBuffer = Buffer.concat(chunks);
    }

    if (rawBuffer.length > MAX_BODY_SIZE) {
      res.statusCode = 413;
      return res.end(
        JSON.stringify({
          ok: false,
          error:
            "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
        }),
      );
    }

    // 6. Extract PDF binary
    const pdfBuffer = extractPdfBuffer(rawBuffer);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      res.statusCode = 422;
      return res.end(JSON.stringify({ ok: false, error: "הקובץ שנשלח אינו קובץ PDF תקין" }));
    }

    // 7. Load with pdf-lib and check page count
    let srcDoc: PDFDocument;
    let totalPages = 0;
    try {
      srcDoc = await PDFDocument.load(pdfBuffer);
      totalPages = srcDoc.getPageCount();
    } catch {
      res.statusCode = 422;
      return res.end(
        JSON.stringify({
          ok: false,
          error: "שגיאה בפענוח קובץ ה-PDF (הקובץ פגום או לא קריא)",
        }),
      );
    }

    if (totalPages < 3) {
      res.statusCode = 422;
      return res.end(
        JSON.stringify({
          ok: false,
          error:
            "הקובץ מכיל פחות מ-3 עמודים (נדרשים לפחות עמוד מניפסט, תעודת משלוח אחת ודיסקית טכוגרף)",
        }),
      );
    }

    // 8. Split Pages:
    // Pages 2 to N-1 (index 1 to totalPages - 2)
    const pages: string[] = [];
    for (let i = 1; i < totalPages - 1; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      if (copiedPage) singleDoc.addPage(copiedPage);
      const pageBytes = await singleDoc.save();
      pages.push(Buffer.from(pageBytes).toString("base64"));
    }

    // Page N: Tachograph disc (index totalPages - 1)
    const tachoDoc = await PDFDocument.create();
    const [tachoPage] = await tachoDoc.copyPages(srcDoc, [totalPages - 1]);
    if (tachoPage) tachoDoc.addPage(tachoPage);
    const tachoBytes = await tachoDoc.save();
    const tachograph_page = Buffer.from(tachoBytes).toString("base64");

    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: true,
        page_count: totalPages,
        pages,
        tachograph_page,
      }),
    );
  } catch (err) {
    console.error("Vercel function split-scan error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(
        JSON.stringify({
          ok: false,
          error: "שגיאת שרת בעיבוד הסריקה: " + String((err as Error)?.message || err),
        }),
      );
    }
  }
}

// Fallback for Web standard Request (Edge / Vite SSR)
async function handleWebRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method === "GET") {
    return Response.json(
      { ok: true, service: "split-scan" },
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  if (method !== "POST") {
    return Response.json(
      { ok: false, error: "Method Not Allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  const requiredToken = process.env.SPLIT_SCAN_TOKEN;
  if (requiredToken) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== requiredToken) {
      return Response.json(
        { ok: false, error: "טוקן אימות חסר או שגוי" },
        { status: 401, headers: corsHeaders },
      );
    }
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return Response.json(
      {
        ok: false,
        error:
          "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
      },
      { status: 413, headers: corsHeaders },
    );
  }

  const arrayBuffer = await request.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  if (rawBuffer.length > MAX_BODY_SIZE) {
    return Response.json(
      {
        ok: false,
        error:
          "קובץ ה-PDF חורג ממגבלת הגודל המרבי (4.5MB). יש להעלות קובץ קטן יותר או לפצל בצד הסקריפט.",
      },
      { status: 413, headers: corsHeaders },
    );
  }

  const pdfBuffer = extractPdfBuffer(rawBuffer);
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return Response.json(
      { ok: false, error: "הקובץ שנשלח אינו קובץ PDF תקין" },
      { status: 422, headers: corsHeaders },
    );
  }

  let srcDoc: PDFDocument;
  let totalPages = 0;
  try {
    srcDoc = await PDFDocument.load(pdfBuffer);
    totalPages = srcDoc.getPageCount();
  } catch {
    return Response.json(
      { ok: false, error: "שגיאה בפענוח קובץ ה-PDF" },
      { status: 422, headers: corsHeaders },
    );
  }

  if (totalPages < 3) {
    return Response.json(
      {
        ok: false,
        error:
          "הקובץ מכיל פחות מ-3 עמודים (נדרשים לפחות עמוד מניפסט, תעודת משלוח אחת ודיסקית טכוגרף)",
      },
      { status: 422, headers: corsHeaders },
    );
  }

  const pages: string[] = [];
  for (let i = 1; i < totalPages - 1; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
    if (copiedPage) singleDoc.addPage(copiedPage);
    const pageBytes = await singleDoc.save();
    pages.push(Buffer.from(pageBytes).toString("base64"));
  }

  const tachoDoc = await PDFDocument.create();
  const [tachoPage] = await tachoDoc.copyPages(srcDoc, [totalPages - 1]);
  if (tachoPage) tachoDoc.addPage(tachoPage);
  const tachoBytes = await tachoDoc.save();
  const tachograph_page = Buffer.from(tachoBytes).toString("base64");

  return Response.json(
    {
      ok: true,
      page_count: totalPages,
      pages,
      tachograph_page,
    },
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    },
  );
}
