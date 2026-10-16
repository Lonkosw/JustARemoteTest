// Signs Supabase-style access tokens for the local test backend.
import crypto from "node:crypto";

export const JWT_SECRET = "local-test-secret-not-for-production-0123456789";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signAccessToken(userId) {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    email: `${userId.slice(0, 8)}@test.local`,
    exp: 4102444800, // 2100-01-01
  });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

if (process.argv[2]) console.log(signAccessToken(process.argv[2]));
