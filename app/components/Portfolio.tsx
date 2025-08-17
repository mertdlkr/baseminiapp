"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./DemoComponents";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { portfolioRegistryAbi, portfolioRegistryAddress } from "@/lib/portfolio-abi";

type Holding = {
  id: string; // unique id like coingecko:bitcoin or chain:address
  symbol?: string;
  name?: string;
  amount: number; // user-entered balance
};

type PriceMap = Record<string, { symbol?: string; price: number }>;

function formatCurrency(value: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function toAssetId(id: string): `0x${string}` {
  // Deterministic asset id: keccak256 of the id string via viem util inlined here
  // Since we are client-side only, use a simple hash fallback if crypto.subtle is missing
  const enc = new TextEncoder().encode(id);
  // Fallback djb2 hash to bytes, then pad to 32 bytes
  let hash = 5381;
  for (let i = 0; i < enc.length; i++) hash = ((hash << 5) + hash) ^ enc[i];
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return ("0x" + hex.padStart(64, "0")) as `0x${string}`;
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "coingecko:bitcoin", symbol: "BTC", name: "Bitcoin", amount: 0.0 },
    { id: "coingecko:ethereum", symbol: "ETH", name: "Ethereum", amount: 0.0 },
  ]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const write = useWriteContract();

  const ids = useMemo(() => holdings.map((h) => h.id).join(","), [holdings]);

  useEffect(() => {
    let ignore = false;
    async function fetchPrices() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/prices?ids=${encodeURIComponent(ids)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Price API error: ${res.status}`);
        const data = (await res.json()) as { prices: PriceMap };
        if (!ignore) setPrices(data.prices || {});
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (ids.length) fetchPrices();
    const t = setInterval(() => {
      if (ids.length) fetchPrices();
    }, 5_000);
    return () => {
      ignore = true;
      clearInterval(t);
    };
  }, [ids]);

  const totalUsd = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const p = prices[h.id]?.price ?? 0;
      return sum + h.amount * p;
    }, 0);
  }, [holdings, prices]);

  const assetIdsBytes32 = useMemo(() =>
    holdings.map((h) => toAssetId(h.id)),
  [holdings]);

  // Read on-chain saved amounts if connected
  const { data: chainAmounts } = useReadContract({
    address: portfolioRegistryAddress,
    abi: portfolioRegistryAbi,
    functionName: "getMany",
    args: address ? [address, assetIdsBytes32] : undefined,
  });

  useEffect(() => {
    if (!chainAmounts) return;
    setHoldings((prev) => prev.map((h, i) => ({
      ...h,
      amount: Number(formatUnits((chainAmounts[i] ?? 0n) as bigint, 18)),
    })));
  }, [chainAmounts]);

  const saveOnChain = useCallback(async () => {
    try {
      const amounts = holdings.map((h) => parseUnits(String(h.amount || 0), 18));
      await write.writeContract({
        address: portfolioRegistryAddress,
        abi: portfolioRegistryAbi,
        functionName: "setMany",
        args: [assetIdsBytes32, amounts],
      });
    } catch (e) {
      console.error(e);
    }
  }, [assetIdsBytes32, holdings, write]);

  function updateAmount(index: number, nextAmount: number) {
    setHoldings((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], amount: isFinite(nextAmount) ? nextAmount : 0 };
      return copy;
    });
  }

  // addRow retained for potential future use
  function addRow() {}

  function removeRow(index: number) {
    setHoldings((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-[var(--app-foreground)]">Portfolio</h3>
        <div className="flex items-center gap-2">
          <AssetPicker onPick={(asset) => setHoldings((prev) => [...prev, asset])} />
          <Button variant="primary" size="sm" onClick={saveOnChain}>
            Save On-chain
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--app-card-border)] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-[var(--app-foreground-muted)] bg-[var(--app-card-bg)] sticky top-0 z-10">
          <div className="col-span-4">Asset</div>
          <div className="col-span-3 text-right">Price</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-2 text-right">Value</div>
        </div>

        {holdings.map((h, i) => {
          const price = prices[h.id]?.price ?? 0;
          const symbol = h.symbol || prices[h.id]?.symbol || "";
          const value = h.amount * price;
          return (
            <div
              key={`${h.id}-${i}`}
              className="grid grid-cols-12 gap-2 items-center px-4 py-3 border-t border-[var(--app-card-border)]"
            >
              <div className="col-span-4">
                <div className="text-sm text-[var(--app-foreground)]">{h.name || h.id}</div>
                <div className="text-xs text-[var(--app-foreground-muted)]">{symbol}</div>
              </div>
              <div className="col-span-3 text-right text-sm">
                {loading ? "…" : formatCurrency(price)}
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className="w-full text-right px-2 py-1 bg-[var(--app-background)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]"
                  value={Number.isFinite(h.amount) ? h.amount : 0}
                  onChange={(e) => updateAmount(i, parseFloat(e.target.value))}
                />
              </div>
              <div className="col-span-2 text-right text-sm">
                {formatCurrency(value)}
              </div>
              <div className="col-span-12 flex justify-end">
                <button
                  type="button"
                  className="text-[var(--app-foreground-muted)] hover:text-[var(--app-foreground)] text-xs"
                  onClick={() => removeRow(i)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <div className="px-4 py-3 border-t border-[var(--app-card-border)] flex items-center justify-between">
          <div className="text-sm text-[var(--app-foreground-muted)]">
            {error ? <span className="text-red-500">{error}</span> : loading ? "Updating prices…" : ""}
          </div>
          <div className="text-sm font-medium">Total: {formatCurrency(totalUsd)}</div>
        </div>
      </div>
    </div>
  );
}

function AssetPicker({ onPick }: { onPick: (h: Holding) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options: Holding[] = [
    { id: "coingecko:bitcoin", symbol: "BTC", name: "Bitcoin", amount: 0 },
    { id: "coingecko:ethereum", symbol: "ETH", name: "Ethereum", amount: 0 },
    { id: "coingecko:solana", symbol: "SOL", name: "Solana", amount: 0 },
    { id: "coingecko:chainlink", symbol: "LINK", name: "Chainlink", amount: 0 },
    { id: "coingecko:base-ecosystem-token", symbol: "BASE", name: "Base", amount: 0 },
    { id: "coingecko:usd-coin", symbol: "USDC", name: "USD Coin", amount: 0 },
    { id: "coingecko:tether", symbol: "USDT", name: "Tether", amount: 0 },
    { id: "coingecko:arbitrum", symbol: "ARB", name: "Arbitrum", amount: 0 },
    { id: "coingecko:optimism", symbol: "OP", name: "Optimism", amount: 0 },
    { id: "coingecko:avalanche-2", symbol: "AVAX", name: "Avalanche", amount: 0 },
    { id: "coingecko:polygon-ecosystem-token", symbol: "POL", name: "Polygon", amount: 0 },
    { id: "coingecko:ripple", symbol: "XRP", name: "XRP", amount: 0 },
    { id: "coingecko:cardano", symbol: "ADA", name: "Cardano", amount: 0 },
    { id: "coingecko:dogecoin", symbol: "DOGE", name: "Dogecoin", amount: 0 },
  ];
  const filtered = options
    .filter(
      (o) => o.name?.toLowerCase().includes(query.toLowerCase()) || o.symbol?.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 20);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((s) => !s)}>
        Add Asset
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 z-20 rounded-lg border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-2 shadow-lg">
          <input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-2 py-1 mb-2 bg-[var(--app-background)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)]"
          />
          <div className="max-h-56 overflow-auto space-y-1">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className="w-full text-left px-2 py-1 rounded hover:bg-[var(--app-accent-light)] text-sm"
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.name} <span className="text-[var(--app-foreground-muted)]">{o.symbol}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-[var(--app-foreground-muted)] px-2 py-1">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


