// Minimal Web Push sender (VAPID, no payload) that runs on Cloudflare Workers.
// Messages carry no data: the service worker fetches the text from
// /api/public/push/latest when a push arrives, so no payload encryption is needed.

type Jwk = { kty: "EC"; crv: "P-256"; x: string; y: string; d: string };

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Signs one VAPID JWT per push service origin (valid 12 h). */
export async function vapidAuth(jwk: Jwk, publicKey: string, subject: string, endpoint: string) {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${publicKey}`;
}

export type PushResult = { ok: boolean; gone: boolean; status: number };

export async function sendEmptyPush(endpoint: string, authHeader: string): Promise<PushResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: authHeader, TTL: "3600", Urgency: "high", "Content-Length": "0" },
    });
    return { ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch {
    return { ok: false, gone: false, status: 0 };
  }
}
