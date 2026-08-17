import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The app binds to 127.0.0.1 and is meant to be used only by the local
 * Electron window (or a local browser in dev). Without this check, a
 * malicious website could use DNS rebinding to reach the API and trigger
 * downloads or installs from the victim's machine. Reject any request whose
 * Host header is not a local loopback host.
 */
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (!LOOPBACK_HOST.test(host)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.ico).*)"],
};
