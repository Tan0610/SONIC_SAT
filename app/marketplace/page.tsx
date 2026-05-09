"use client";
export const dynamic = "force-dynamic";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import ListingGrid from "@/components/ListingGrid";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useActiveListings, type HydratedListing } from "@/hooks/useActiveListings";
import { useBuy } from "@/hooks/useBuy";

export default function MarketplacePage() {
  const { isConnected } = useAccount();
  const { listings, isLoading, error, refetch } = useActiveListings();
  const { buy, isPending } = useBuy();
  const [pendingTokenId, setPendingTokenId] = useState<bigint | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleBuy = async (listing: HydratedListing) => {
    if (!isConnected) {
      setStatusMessage({ kind: "error", text: "Connect a wallet first." });
      return;
    }
    setPendingTokenId(listing.tokenId);
    setStatusMessage(null);
    try {
      const hash = await buy(listing.tokenId, listing.price);
      setStatusMessage({
        kind: "success",
        text: `Purchased token #${listing.tokenId.toString()} (tx: ${hash.slice(0, 10)}...)`,
      });
      await refetch();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setStatusMessage({
        kind: "error",
        text: err?.shortMessage || err?.message || "Purchase failed",
      });
    } finally {
      setPendingTokenId(null);
    }
  };

  return (
    <BuyerDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
          <p className="text-gray-400">
            Every active listing on SonicVoiceMarketplace. Click Buy to send tFIL on-chain.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`rounded-lg p-4 text-sm ${
              statusMessage.kind === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-300">
            Failed to load listings: {error.message}
          </div>
        )}

        {isLoading && listings.length === 0 ? (
          <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-12 text-center text-gray-400">
            Loading marketplace listings...
          </div>
        ) : (
          <ListingGrid
            mode="buy"
            listings={listings}
            onBuy={handleBuy}
            isPending={isPending}
            pendingTokenId={pendingTokenId}
            emptyTitle="No active listings"
            emptyMessage="Be the first to mint and list audio on Filecoin Calibration."
          />
        )}
      </div>
    </BuyerDashboardLayout>
  );
}
