import { NextResponse } from "next/server";
import { getFeaturedMatches } from "@/lib/queries";

// Lightweight JSON feed for the home featured-match card. Polled client-side
// every ~30s. Always dynamic + no-store so each poll reflects the latest sync.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await getFeaturedMatches();
    return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ matches: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
