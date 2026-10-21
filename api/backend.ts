// api/backend.ts
import { handleBackendApiRequest } from "../src/lib/backend-handler";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // סביבת Vercel Serverless (Node.js)
  if (res && typeof res.setHeader === "function") {
    try {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${req.url}`;

      const method = (req.method || "GET").toUpperCase();
      let body: Buffer | undefined = undefined;

      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        if (req.body) {
          if (Buffer.isBuffer(req.body)) {
            body = req.body;
          } else if (typeof req.body === "string") {
            body = Buffer.from(req.body, "utf-8");
          } else {
            body = Buffer.from(JSON.stringify(req.body), "utf-8");
          }
        } else {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            if (chunks.length > 0) {
              body = Buffer.concat(chunks);
            }
          } catch {
            // Stream might already be closed or empty
          }
        }
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (!key || key.startsWith(":")) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else if (value !== undefined && value !== null) {
          headers.set(key, String(value));
        }
      }

      const webReq = new Request(fullUrl, {
        method,
        headers,
        body: ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : body,
      });

      const webRes = await handleBackendApiRequest(webReq);

      res.statusCode = webRes.status;
      webRes.headers.forEach((val: string, key: string) => {
        res.setHeader(key, val);
      });

      const arrayBuffer = await webRes.arrayBuffer();
      return res.end(Buffer.from(arrayBuffer));
    } catch (err: unknown) {
      console.error("Vercel backend handler error:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.end(
        JSON.stringify({
          ok: false,
          error: "שגיאת שרת פנימית ב-Vercel: " + errMsg,
        }),
      );
    }
  }

  // סביבת Edge / Web Fetch
  return await handleBackendApiRequest(req);
}
