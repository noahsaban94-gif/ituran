// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { handleSplitScanRequest } from "./src/lib/split-scan-handler";
import { handleScanProxyRequest } from "./src/lib/scan-proxy-handler";
import { handleSaveNoteRequest } from "./src/lib/save-note-handler";
import { handleBackendApiRequest } from "./src/lib/backend-handler";

function splitScanPlugin() {
  return {
    name: "split-scan-api",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
        const isSplitScan =
          url.pathname === "/api/split-scan" || url.pathname === "/api/split-scan/";
        const isScanProxy = url.pathname.startsWith("/api/scan");
        const isSaveNote = url.pathname === "/api/save-note" || url.pathname === "/api/save-note/";
        const isBackend =
          url.pathname.startsWith("/api/backend") ||
          url.pathname.startsWith("/api/ai") ||
          url.pathname === "/api/status";

        if (isSplitScan || isScanProxy || isSaveNote || isBackend) {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = Buffer.concat(chunks);

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (Array.isArray(value)) {
                for (const v of value) headers.append(key, v);
              } else if (value) {
                headers.set(key, String(value));
              }
            }

            const webReq = new Request(url.href, {
              method: req.method,
              headers,
              body: ["GET", "HEAD", "OPTIONS"].includes(req.method || "") ? undefined : body,
            });

            let webRes: Response;
            if (isSplitScan) {
              webRes = await handleSplitScanRequest(webReq);
            } else if (isScanProxy) {
              webRes = await handleScanProxyRequest(webReq);
            } else if (isBackend) {
              webRes = await handleBackendApiRequest(webReq);
            } else {
              webRes = await handleSaveNoteRequest(webReq);
            }

            res.statusCode = webRes.status;
            webRes.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });
            const arrayBuffer = await webRes.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err) {
            console.error("API middleware error:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "שגיאת שרת פנימית" }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    plugins: [splitScanPlugin()],
  },
});
