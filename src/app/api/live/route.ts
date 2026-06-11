import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/queries";

// Lightweight JSON feed for the home "LIVE NOW" card. Polled client-side every
// ~30s. Always dynamic + no-store so each poll reflects the latest sync.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await getLiveMatches();
    return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ matches: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
