// Local stand-in for the Supabase HTTP API, for tests:
//   /rest/v1/*     -> PostgREST (database, RLS)
//   /storage/v1/*  -> a tiny Storage server on disk: upload, download and
//                     remove, where users may only touch "<their id>/..."
// Usage: node proxy.mjs <port> <postgrest-port> <storage-dir>
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { JWT_SECRET } from "./jwt.mjs";

const [port = "54321", upstreamPort = "3301", storageDir = "/tmp/treino-test-storage"] = process.argv.slice(2);

/** Verified `sub` of the bearer token, or null. */
function userFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const [header, payload, signature] = token.split(".");
  if (!signature) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (expected !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return claims.role === "authenticated" ? claims.sub : null;
}

function json(res, status, body, headers) {
  res.writeHead(status, { ...headers, "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function storage(req, res, cors) {
  const user = userFrom(req);
  if (!user) return json(res, 400, { statusCode: "403", error: "Unauthorized", message: "invalid token" }, cors);

  const url = new URL(req.url, "http://local");
  const parts = decodeURIComponent(url.pathname)
    .replace(/^\/storage\/v1\/object\/(authenticated\/)?/, "")
    .split("/");
  const [bucket, ...rest] = parts;
  const objectPath = rest.join("/");
  const owns = (p) => p.split("/")[0] === user && !p.includes("..");
  const file = (p) => path.join(storageDir, bucket, p);

  if (req.method === "DELETE" && !objectPath) {
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    const removed = prefixes.filter(owns).filter((p) => fs.existsSync(file(p)));
    removed.forEach((p) => fs.rmSync(file(p)));
    return json(res, 200, removed.map((name) => ({ name })), cors);
  }
  if (!owns(objectPath)) {
    return json(res, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }, cors);
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req);
    fs.mkdirSync(path.dirname(file(objectPath)), { recursive: true });
    fs.writeFileSync(file(objectPath), body);
    return json(res, 200, { Key: `${bucket}/${objectPath}`, Id: crypto.randomUUID() }, cors);
  }
  if (req.method === "GET") {
    if (!fs.existsSync(file(objectPath))) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" }, cors);
    res.writeHead(200, { ...cors, "content-type": "image/jpeg" });
    return res.end(fs.readFileSync(file(objectPath)));
  }
  return json(res, 405, { message: "method not allowed" }, cors);
}

function rest(req, res, cors) {
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
}

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
    if (req.url.startsWith("/rest/v1")) return rest(req, res, cors);
    if (req.url.startsWith("/storage/v1/object")) {
      return storage(req, res, cors).catch((error) => json(res, 500, { message: String(error) }, cors));
    }
    json(res, 404, {}, cors);
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`proxy listening on ${port}`));
