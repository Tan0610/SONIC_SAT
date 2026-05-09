"use client";
import { Music } from "lucide-react";
import MarketplaceCard from "@/components/MarketplaceCard";
import type { HydratedListing } from "@/hooks/useActiveListings";
import type { OwnedToken } from "@/hooks/useOwnedTokens";

export type ListingGridBuyProps = {
  mode: "buy";
  listings: HydratedListing[];
  onBuy?: (listing: HydratedListing) => void;
  isPending?: boolean;
  pendingTokenId?: bigint | null;
  emptyTitle?: string;
  emptyMessage?: string;
};

export type ListingGridOwnedProps = {
  mode: "owned";
  owned: OwnedToken[];
  onCancel?: (owned: OwnedToken) => void;
  onList?: (owned: OwnedToken) => void;
  isPending?: boolean;
  pendingTokenId?: bigint | null;
  emptyTitle?: string;
  emptyMessage?: string;
};

export type ListingGridProps = ListingGridBuyProps | ListingGridOwnedProps;

export default function ListingGrid(props: ListingGridProps) {
  const items = props.mode === "buy" ? props.listings : props.owned;
  if (items.length === 0) {
    return (
      <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Music className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {props.emptyTitle ?? (props.mode === "buy" ? "No listings yet" : "No tokens yet")}
        </h3>
        <p className="text-gray-400">
          {props.emptyMessage ??
            (props.mode === "buy"
              ? "Check back soon — creators are minting new audio every day."
              : "Mint your first audio IP to see it here.")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {props.mode === "buy"
        ? props.listings.map((listing) => (
            <MarketplaceCard
              key={listing.tokenId.toString()}
              mode="buy"
              listing={listing}
              onBuy={props.onBuy}
              isPending={
                Boolean(props.isPending) &&
                (props.pendingTokenId === undefined ||
                  props.pendingTokenId === null ||
                  props.pendingTokenId === listing.tokenId)
              }
            />
          ))
        : props.owned.map((owned) => (
            <MarketplaceCard
              key={owned.tokenId.toString()}
              mode="owned"
              owned={owned}
              onCancel={props.onCancel}
              onList={props.onList}
              isPending={
                Boolean(props.isPending) &&
                (props.pendingTokenId === undefined ||
                  props.pendingTokenId === null ||
                  props.pendingTokenId === owned.tokenId)
              }
            />
          ))}
    </div>
  );
}
