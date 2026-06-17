import { NextResponse } from "next/server";
import { getMatchLive } from "@/lib/queries";

// Per-match live feed (lineups, events, score, minute) for the in-play pitch.
// Polled client-side; always dynamic + no-store.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getMatchLive(id);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ data: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
