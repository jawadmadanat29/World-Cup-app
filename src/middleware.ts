import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/auth-token";

// Protects every /admin route. Mutations (server actions) additionally call
// requireAdmin() as defence-in-depth.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET || "dev-only-change-me-to-a-long-random-string";
  const ok = await verifyAdminToken(secret, token);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin-login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
