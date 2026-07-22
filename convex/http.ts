/**
 * Convex HTTP Routes
 * Required for Better Auth route handling
 * @see https://convex-better-auth.netlify.app/
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes with CORS enabled for client-side frameworks
authComponent.registerRoutes(http, createAuth, { cors: true });

// ── BH Sensors API proxy ─────────────────────────────────────────────────────
// The hardware REST server (TMS XData on asvupdateserver.ddns.net:2001) does
// not answer CORS preflights, so browsers block direct fetches from the web
// app even though the server itself is up (the native test program works
// because it has no CORS layer). This proxy forwards requests server-side,
// where CORS doesn't apply, and replies with proper CORS headers.
//
// GET https://<convex-site>/bh/<endpoint>?<query>  →
// GET https://asvupdateserver.ddns.net:2001/tms/xdata/MyService/<endpoint>?<query>
//
// The upstream bearer token lives here (server-side) instead of in the
// shipped JS bundle.

const BH_UPSTREAM = "https://asvupdateserver.ddns.net:2001/tms/xdata/MyService";
const BH_TOKEN = "secret_token";

function bhCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  let trusted = origin === "null";
  try {
    const host = new URL(origin).hostname;
    trusted =
      trusted ||
      host.endsWith(".vercel.app") ||
      host.endsWith(".modal.host") ||
      host.endsWith(".shipper.now") ||
      host === "localhost" ||
      host === "127.0.0.1";
  } catch {
    /* not a URL — leave untrusted */
  }
  if (!trusted) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

http.route({
  pathPrefix: "/bh/",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const endpoint = url.pathname.replace(/^\/bh\//, "");
    // Endpoint names are simple identifiers — refuse anything path-like.
    if (!/^[A-Za-z0-9_]+$/.test(endpoint)) {
      return new Response(JSON.stringify({ error: "Bad endpoint" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...bhCorsHeaders(request) },
      });
    }
    const upstreamUrl = `${BH_UPSTREAM}/${endpoint}${url.search}`;
    try {
      const upstream = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${BH_TOKEN}`,
        },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "application/json",
          "Cache-Control": "no-store",
          ...bhCorsHeaders(request),
        },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Upstream unreachable", detail: e instanceof Error ? e.message : String(e) }),
        { status: 502, headers: { "Content-Type": "application/json", ...bhCorsHeaders(request) } },
      );
    }
  }),
});

http.route({
  pathPrefix: "/bh/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: {
        ...bhCorsHeaders(request),
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
