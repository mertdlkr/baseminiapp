import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple price proxy using DefiLlama aggregator
// Accepts query param `ids` (comma-separated). Supported formats:
// - coingecko:bitcoin, coingecko:ethereum
// - base:0x... (EVM chain tokens)
// - ethereum:0x... etc.

const DEFAULT_IDS = [
  "coingecko:bitcoin",
  "coingecko:ethereum",
  "coingecko:solana",
  "coingecko:base-ecosystem-token",
  "coingecko:chainlink",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const ids = (idsParam ? idsParam.split(",") : [...DEFAULT_IDS]).map((s) =>
      s.trim(),
    );

    const url = `https://coins.llama.fi/prices/current/${encodeURIComponent(ids.join(","))}?searchWidth=8h`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: 502 },
      );
    }
    const json = await res.json();

    // Normalize output
    const prices: Record<string, { symbol?: string; price: number }> = {};
    if (json && json.coins) {
      for (const key of Object.keys(json.coins)) {
        prices[key] = {
          symbol: json.coins[key]?.symbol,
          price: Number(json.coins[key]?.price ?? 0),
        };
      }
    }

    return NextResponse.json(
      { prices, ts: Date.now() },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}


