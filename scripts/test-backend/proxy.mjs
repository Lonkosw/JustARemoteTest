// Serves PostgREST under /rest/v1 like Supabase does, with CORS, so the app
// can point NEXT_PUBLIC_SUPABASE_URL at it. Usage: node proxy.mjs <port> <postgrest-port>
import http from "node:http";

const [port = "54321", upstreamPort = "3301"] = process.argv.slice(2);

http
  .createServer((req, res) => {
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "access-control-expose-headers": "content-range",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (!req.url.startsWith("/rest/v1")) {
      res.writeHead(404, { ...cors, "content-type": "application/json" });
      return res.end("{}");
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: Number(upstreamPort),
        path: req.url.slice("/rest/v1".length) || "/",
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${upstreamPort}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      res.writeHead(502, cors);
      res.end(String(error));
    });
    req.pipe(upstream);
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`proxy listening on ${port}`));
