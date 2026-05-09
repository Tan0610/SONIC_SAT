"use client";
export const dynamic = "force-dynamic";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import ListingGrid from "@/components/ListingGrid";
import { WalletConnect } from "@/components/walletConnect";
import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useOwnedTokens, type OwnedToken } from "@/hooks/useOwnedTokens";
import { useCancelListing } from "@/hooks/useCancelListing";
import { useListExisting } from "@/hooks/useListExisting";

export default function CollectionPage() {
  const { isConnected } = useAccount();
  const { owned, isLoading, error, refetch } = useOwnedTokens();
  const { cancelListing, isPending: isCancelling } = useCancelListing();
  const { listExisting, isPending: isListing } = useListExisting();
  const [pendingTokenId, setPendingTokenId] = useState<bigint | null>(null);
  const [listForm, setListForm] = useState<{ token: OwnedToken; price: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleCancel = async (token: OwnedToken) => {
    setPendingTokenId(token.tokenId);
    setStatusMessage(null);
    try {
      const hash = await cancelListing(token.tokenId);
      setStatusMessage({
        kind: "success",
        text: `Cancelled listing for #${token.tokenId.toString()} (tx: ${hash.slice(0, 10)}...)`,
      });
      await refetch();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setStatusMessage({
        kind: "error",
        text: err?.shortMessage || err?.message || "Cancel failed",
      });
    } finally {
      setPendingTokenId(null);
    }
  };

  const handleListPrompt = (token: OwnedToken) => {
    setListForm({ token, price: "" });
    setStatusMessage(null);
  };

  const handleListSubmit = async () => {
    if (!listForm) return;
    const { token, price } = listForm;
    if (!price || parseFloat(price) <= 0) {
      setStatusMessage({ kind: "error", text: "Enter a price greater than zero." });
      return;
    }
    let priceWei: bigint;
    try {
      priceWei = parseEther(price);
    } catch {
      setStatusMessage({ kind: "error", text: "Invalid price." });
      return;
    }

    setPendingTokenId(token.tokenId);
    setStatusMessage(null);
    try {
      const { listHash } = await listExisting(token.tokenId, priceWei);
      setStatusMessage({
        kind: "success",
        text: `Listed #${token.tokenId.toString()} for ${price} tFIL (tx: ${listHash.slice(0, 10)}...)`,
      });
      setListForm(null);
      await refetch();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setStatusMessage({
        kind: "error",
        text: err?.shortMessage || err?.message || "Listing failed",
      });
    } finally {
      setPendingTokenId(null);
    }
  };

  return (
    <BuyerDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Collection</h1>
          <p className="text-gray-400">
            Tokens you currently own. List unsold ones for sale, or cancel an active listing.
          </p>
        </div>

        {!isConnected ? (
          <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-8 text-center">
            <p className="text-gray-300 mb-4">
              Connect your wallet to load tokens you own on Filecoin Calibration.
            </p>
            <div className="flex justify-center">
              <WalletConnect />
            </div>
          </div>
        ) : (
          <>
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
                Failed to load your tokens: {error.message}
              </div>
            )}

            {/* List-for-sale form modal-style inline */}
            {listForm && (
              <div className="bg-[var(--card-background)] border border-orange-500/40 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  List token #{listForm.token.tokenId.toString()} for sale
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Approves the marketplace contract, then submits a listing in tFIL.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-300 mb-1">Price (tFIL)</label>
                    <input
                      type="number"
                      value={listForm.price}
                      onChange={(e) =>
                        setListForm((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                      }
                      placeholder="0.01"
                      step="0.0001"
                      min="0"
                      className="w-full bg-[var(--sidebar-background)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleListSubmit}
                      disabled={isListing || !listForm.price}
                      className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
                    >
                      {isListing ? "Listing..." : "Confirm List"}
                    </button>
                    <button
                      onClick={() => setListForm(null)}
                      disabled={isListing}
                      className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoading && owned.length === 0 ? (
              <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-12 text-center text-gray-400">
                Scanning your token history on Filecoin Calibration...
              </div>
            ) : (
              <ListingGrid
                mode="owned"
                owned={owned}
                onCancel={handleCancel}
                onList={handleListPrompt}
                isPending={isCancelling || isListing}
                pendingTokenId={pendingTokenId}
                emptyTitle="No tokens yet"
                emptyMessage="Mint one from the seller dashboard to see it here."
              />
            )}
          </>
        )}
      </div>
    </BuyerDashboardLayout>
  );
}
