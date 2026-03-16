import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { serverConfig } from "@/lib/server-config";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    forwardedProtocol === "https" ||
    (forwardedProtocol?.toLowerCase() === "https,https");

  if (serverConfig.security.requireHttps && !isHttps && request.nextUrl.host !== "localhost" && request.nextUrl.host !== "127.0.0.1") {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl);
  }

  if (serverConfig.security.requireHttps) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "no-cache");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
