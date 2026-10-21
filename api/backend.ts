// api/backend.ts
import { handleBackendApiRequest } from "../src/lib/backend-handler";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  // סביבת Vercel Serverless (Node.js)
  if (res && typeof res.setHeader === "function") {
    try {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${req.url}`;

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else if (value) {
          headers.set(key, String(value));
        }
      }

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD", "OPTIONS"].includes((req.method || "").toUpperCase()) ? undefined : body,
      });

      const webRes = await handleBackendApiRequest(webReq);

      res.statusCode = webRes.status;
      webRes.headers.forEach((val: string, key: string) => {
        res.setHeader(key, val);
      });

      const arrayBuffer = await webRes.arrayBuffer();
      return res.end(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("Vercel backend handler error:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "שגיאת שרת פנימית ב-Vercel: " + err.message }));
    }
  }

  // סביבת Edge / Web Fetch
  return await handleBackendApiRequest(req);
}