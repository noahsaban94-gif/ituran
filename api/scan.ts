import fs from "fs";
import path from "path";
import { handleScanProxyRequest } from "../src/lib/scan-proxy-handler";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res?: any) {
  // If Web standard Request environment
  if (!res && typeof req?.headers?.get === "function") {
    try {
      const resp = await handleScanProxyRequest(req as Request);
      if (resp.status === 404) {
        // Return default disc SVG on 404
        const svgPath = path.resolve(process.cwd(), "public/assets/default-tachograph-disc.svg");
        if (fs.existsSync(svgPath)) {
          const svgContent = fs.readFileSync(svgPath);
          return new Response(svgContent, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "image/svg+xml",
              "Content-Length": String(svgContent.length),
            },
          });
        }
      }
      return resp;
    } catch (err) {
      console.error("Scan proxy error:", err);
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Node.js Serverless environment (Vercel)
  try {
    const method = (req.method || "GET").toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      res.statusCode = 204;
      for (const [k, v] of Object.entries(corsHeaders)) {
        res.setHeader(k, v);
      }
      return res.end();
    }

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
    const fullUrl = `${protocol}://${host}${req.url || "/api/scan"}`;

    const headers = new Headers();
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(", "));
      }
    }

    const standardReq = new Request(fullUrl, {
      method,
      headers,
    });

    const standardRes = await handleScanProxyRequest(standardReq);

    // If Google Drive file was not publicly viewable or returned 404, deliver default verified disc
    if (standardRes.status === 404) {
      const svgPath = path.resolve(process.cwd(), "public/assets/default-tachograph-disc.svg");
      if (fs.existsSync(svgPath)) {
        const svgContent = fs.readFileSync(svgPath);
        for (const [k, v] of Object.entries(corsHeaders)) {
          res.setHeader(k, v);
        }
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Content-Length", String(svgContent.length));
        res.statusCode = 200;
        return res.end(svgContent);
      }
    }

    res.statusCode = standardRes.status;
    standardRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const buf = Buffer.from(await standardRes.arrayBuffer());
    return res.end(buf);
  } catch (err: unknown) {
    console.error("api/scan serverless error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const message = err instanceof Error ? err.message : String(err);
    return res.end(JSON.stringify({ ok: false, error: message }));
  }
}
