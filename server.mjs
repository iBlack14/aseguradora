import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = normalize(join(root, requested));

  if (!resolved.startsWith(root) || !existsSync(resolved) || !statSync(resolved).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
    return;
  }

  response.writeHead(200, { "content-type": types[extname(resolved)] || "application/octet-stream" });
  createReadStream(resolved).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Falabella SOAT local: http://127.0.0.1:${port}`);
});
