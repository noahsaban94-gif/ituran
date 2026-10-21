import { PDFDocument } from "pdf-lib";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
};

export function extractDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: /file/d/{id}
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  // Pattern 2: id={id}
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];

  // Pattern 3: /folders/{id} or /document/d/{id} or /spreadsheets/d/{id}
  const matchGenericD = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchGenericD && matchGenericD[1]) return matchGenericD[1];

  // Pattern 4: raw file ID (alphanumeric with dashes/underscores, typically 25-50 chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export async function handleScanProxyRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method !== "GET" && method !== "HEAD") {
    return Response.json(
      { ok: false, error: "Method Not Allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  const url = new URL(request.url);
  // Support both /api/scan/:fileId and /api/scan?id=...&url=...
  const pathParts = url.pathname
    .replace(/^\/api\/scan\/?/, "")
    .split("/")
    .filter(Boolean);
  const pathId = pathParts[0];

  const queryId = url.searchParams.get("id");
  const queryUrl = url.searchParams.get("url");
  const pageParam = url.searchParams.get("page");
  const pageNum = pageParam ? parseInt(pageParam, 10) : undefined;

  const rawTarget = pathId || queryId || queryUrl;

  if (!rawTarget) {
    return Response.json(
      { ok: false, error: "חסר מזהה קובץ סריקה או כתובת Drive (נא לספק fileId או url)" },
      { status: 400, headers: corsHeaders },
    );
  }

  const fileId = extractDriveFileId(rawTarget);
  if (!fileId) {
    return Response.json(
      { ok: false, error: "מזהה קובץ Google Drive אינו תקין" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Attempt to fetch from Google Drive
  // Strategy:
  // 1. If service account or API key configured, use Drive API v3
  // 2. Direct usercontent export URLs (works for public/shared files)
  const candidateUrls: string[] = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    `https://docs.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
  ];

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.GEMINI_API_KEY;

  if (driveApiKey) {
    candidateUrls.unshift(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveApiKey}`,
    );
  }

  let fileBuffer: Buffer | null = null;
  let detectedContentType = "application/pdf";
  let lastError = "";

  for (const candidate of candidateUrls) {
    try {
      const res = await fetch(candidate, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/*,application/pdf,*/*",
        },
        redirect: "follow",
      });

      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);

        // Check if response is an HTML warning/login page from Google
        const textStart = buf.subarray(0, 100).toString("utf-8");
        const isHtml =
          ct.includes("text/html") ||
          textStart.toLowerCase().includes("<!doctype html") ||
          textStart.toLowerCase().includes("<html");

        if (!isHtml && buf.length > 500) {
          fileBuffer = buf;
          if (ct && !ct.includes("text/html")) {
            detectedContentType = ct;
          } else if (buf.subarray(0, 5).toString("utf-8") === "%PDF-") {
            detectedContentType = "application/pdf";
          } else if (buf[0] === 0xff && buf[1] === 0xd8) {
            detectedContentType = "image/jpeg";
          } else if (buf[0] === 0x89 && buf[1] === 0x50) {
            detectedContentType = "image/png";
          }
          break;
        }
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastError = String(err);
    }
  }

  if (!fileBuffer) {
    return Response.json(
      {
        ok: false,
        error: `לא ניתן לטעון את קובץ הסריקה מ-Google Drive (מזהה: ${fileId}). ודא שהקובץ שותף לצפייה או שהוגדר Service Account. [${lastError}]`,
        fileId,
      },
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  // If user requested a specific page from a multi-page PDF
  if (
    detectedContentType === "application/pdf" &&
    pageNum !== undefined &&
    !isNaN(pageNum) &&
    pageNum >= 1
  ) {
    try {
      const srcDoc = await PDFDocument.load(fileBuffer);
      const totalPages = srcDoc.getPageCount();
      const pageIndex = Math.min(Math.max(0, pageNum - 1), totalPages - 1);

      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [pageIndex]);
      if (copiedPage) singleDoc.addPage(copiedPage);

      const singleBytes = await singleDoc.save();
      fileBuffer = Buffer.from(singleBytes);
    } catch (err) {
      console.warn("Could not extract page from PDF:", err);
    }
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": detectedContentType,
      "Content-Length": String(fileBuffer.length),
      "Content-Disposition": `inline; filename="scan-${fileId}.${detectedContentType.includes("pdf") ? "pdf" : "jpg"}"`,
    },
  });
}
