export const config = { runtime: "edge" };

const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const HIGGSFIELD_ORIGIN = "https://platform.higgsfield.ai";
const HIGGSFIELD_PREFIX = "higgsfield/";

const ALLOWED_HEADERS = new Set([
  "accept",
  "authorization",
  "anthropic-beta",
  "anthropic-version",
  "content-type",
  "x-api-key",
  "x-proxy-token",
]);

const BLOCKED_PREFIXES = ["cf-", "x-forwarded-", "x-real-ip", "fly-", "fastly-"];

function isBlockedHeader(name) {
  const n = String(name || "").toLowerCase();
  return BLOCKED_PREFIXES.some((prefix) => n.startsWith(prefix));
}

function buildUpstreamHeaders(reqHeaders) {
  const out = new Headers();
  for (const [key, value] of reqHeaders.entries()) {
    const lower = key.toLowerCase();
    if (isBlockedHeader(lower)) continue;
    if (!ALLOWED_HEADERS.has(lower)) continue;
    if (lower === "host" || lower === "content-length") continue;
    out.set(lower, value);
  }
  if (!out.get("user-agent")) {
    out.set(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    );
  }
  return out;
}

export function resolveUpstream(rawPath) {
  const path = String(rawPath || "").replace(/^\/+/, "");
  if (path.startsWith(HIGGSFIELD_PREFIX)) {
    return {
      origin: HIGGSFIELD_ORIGIN,
      path: path.slice(HIGGSFIELD_PREFIX.length),
      service: "higgsfield",
    };
  }
  return {
    origin: ANTHROPIC_ORIGIN,
    path,
    service: "anthropic",
  };
}

export function buildUpstreamUrl(reqUrl) {
  const input = new URL(reqUrl);
  const rawPath = String(input.searchParams.get("path") || "").replace(/^\/+/, "");
  input.searchParams.delete("path");
  const { origin, path } = resolveUpstream(rawPath);
  const upstream = new URL(`${origin}/${path}`);
  for (const [key, value] of input.searchParams.entries()) {
    upstream.searchParams.append(key, value);
  }
  return upstream.toString();
}

export default async function handler(req) {
  const requiredToken = String(process.env.PROXY_SECRET || "");
  if (requiredToken) {
    const got = String(req.headers.get("x-proxy-token") || "");
    if (got !== requiredToken) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const upstreamUrl = buildUpstreamUrl(req.url);
  const headers = buildUpstreamHeaders(req.headers);

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      redirect: "manual",
    });

    const responseHeaders = new Headers(upstreamResp.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("connection");

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(`Upstream proxy error: ${String(err)}`, { status: 502 });
  }
}
