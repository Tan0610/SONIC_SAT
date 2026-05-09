"use client";
export const dynamic = "force-dynamic";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import { StatCard } from "@/components/StatCard";
import ListingGrid from "@/components/ListingGrid";
import { useRole } from "@/contexts/RoleContext";
import { useAccount } from "wagmi";
import RoleSelection from "@/components/RoleSelection";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { ShoppingCart, Music, TrendingUp, Wallet } from "lucide-react";
import { useActiveListings, type HydratedListing } from "@/hooks/useActiveListings";
import { useBuy } from "@/hooks/useBuy";

export default function BuyerDashboard() {
  const { userRole, isRoleSelected } = useRole();
  const { isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const { listings, isLoading, error, refetch } = useActiveListings();
  const { buy, isPending } = useBuy();
  const [pendingTokenId, setPendingTokenId] = useState<bigint | null>(null);
  const [purchasedListings, setPurchasedListings] = useState<HydratedListing[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (userRole === "seller") {
      window.location.href = "/";
    }
  }, [userRole]);

  // Featured: newest first by tokenId desc, top 6. Computed unconditionally
  // so hook order stays stable across renders.
  const featured = useMemo(() => {
    return [...listings]
      .sort((a, b) => (a.tokenId < b.tokenId ? 1 : a.tokenId > b.tokenId ? -1 : 0))
      .slice(0, 6);
  }, [listings]);

  if (!isClient) {
    return (
      <BuyerDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </BuyerDashboardLayout>
    );
  }

  if (isConnected && !isRoleSelected) {
    return <RoleSelection />;
  }

  const totalSpent = purchasedListings.reduce((acc, l) => acc + l.price, 0n);
  const availableCount = listings.length;

  const handlePurchase = async (listing: HydratedListing) => {
    if (!isConnected) {
      setStatusMessage({ kind: "error", text: "Connect a wallet first." });
      return;
    }
    setPendingTokenId(listing.tokenId);
    setStatusMessage(null);
    try {
      const hash = await buy(listing.tokenId, listing.price);
      setPurchasedListings((prev) => [...prev, listing]);
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
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome to the IP Marketplace</h1>
          <p className="opacity-90">
            Discover and purchase unique audio intellectual property from creators worldwide
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard label="Available IPs" value={availableCount.toString()} icon={Music} />
          <StatCard label="My Purchases" value={purchasedListings.length.toString()} icon={ShoppingCart} />
          <StatCard
            label="Total Spent"
            value={`${formatEther(totalSpent)} tFIL`}
            icon={Wallet}
          />
          <StatCard label="On-Chain" value="Live" icon={TrendingUp} />
        </div>

        {/* Status banner */}
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

        {/* Featured IPs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Featured IPs</h2>
            <a
              href="/marketplace"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </a>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-300">
              Failed to load listings: {error.message}
            </div>
          )}
          {isLoading && featured.length === 0 ? (
            <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-12 text-center text-gray-400">
              Loading marketplace listings...
            </div>
          ) : (
            <ListingGrid
              mode="buy"
              listings={featured}
              onBuy={handlePurchase}
              isPending={isPending}
              pendingTokenId={pendingTokenId}
              emptyTitle="No IPs Available Yet"
              emptyMessage="Check back later or encourage creators to register their IPs!"
            />
          )}
        </div>

        {/* Recent Purchases */}
        {purchasedListings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Recent Purchases</h2>
            <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6">
              <div className="space-y-4">
                {purchasedListings.slice(-3).map((listing) => (
                  <div
                    key={`purchased-${listing.tokenId.toString()}`}
                    className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                  >
                    <div>
                      <h4 className="text-white font-medium">
                        {listing.metadata?.name ?? `Token #${listing.tokenId.toString()}`}
                      </h4>
                      <p className="text-gray-400 text-sm">Purchased successfully</p>
                    </div>
                    <div className="text-green-400 font-semibold">
                      {formatEther(listing.price)} tFIL
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </BuyerDashboardLayout>
  );
}
