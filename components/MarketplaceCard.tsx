"use client";
import { Play, Pause, ShoppingCart, Tag, X } from "lucide-react";
import { useState, useRef } from "react";
import { formatEther } from "viem";
import type { HydratedListing } from "@/hooks/useActiveListings";
import type { OwnedToken } from "@/hooks/useOwnedTokens";
import { ipfsToHttpAll } from "@/lib/ipfsGateway";

export type MarketplaceCardProps =
  | {
      mode: "buy";
      listing: HydratedListing;
      onBuy?: (listing: HydratedListing) => void;
      isPending?: boolean;
    }
  | {
      mode: "owned";
      owned: OwnedToken;
      onCancel?: (owned: OwnedToken) => void;
      onList?: (owned: OwnedToken) => void;
      isPending?: boolean;
    };

function shortAddr(addr: string | undefined) {
  if (!addr) return "unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function MarketplaceCard(props: MarketplaceCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isBuy = props.mode === "buy";
  const metadata = isBuy ? props.listing.metadata : props.owned.metadata;
  const tokenId = isBuy ? props.listing.tokenId : props.owned.tokenId;
  const onChainPrice = isBuy ? props.listing.price : props.owned.listing.price;
  const isListedOnChain = isBuy ? true : props.owned.listing.active;
  const seller = isBuy ? props.listing.seller : props.owned.listing.seller;

  const audioGateways = metadata?.audio_uri ? ipfsToHttpAll(metadata.audio_uri) : [];

  const togglePlayback = async () => {
    if (!audioRef.current || audioGateways.length === 0) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      audioRef.current.src = audioGateways[gatewayIdx] ?? audioGateways[0];
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio playback failed:", err);
      // Try next gateway
      const nextIdx = gatewayIdx + 1;
      if (nextIdx < audioGateways.length) {
        setGatewayIdx(nextIdx);
        audioRef.current.src = audioGateways[nextIdx];
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          return;
        } catch (e) {
          console.error("Fallback audio playback failed:", e);
        }
      }
      alert("Unable to play audio. The file may still be processing on IPFS.");
    }
  };

  const isMalformed = !metadata;
  const displayName = metadata?.name ?? `Token #${tokenId.toString()}`;
  const description = metadata?.description ?? (isMalformed ? "Malformed listing — metadata unavailable." : "");
  const creator = metadata?.creator ?? seller;
  const createdAt = metadata?.created_at ? new Date(metadata.created_at).toLocaleDateString() : "—";
  const duration = metadata?.duration_seconds ?? 0;

  return (
    <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1 truncate">{displayName}</h3>
          <p className="text-gray-400 text-sm">by {shortAddr(creator)}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          {isListedOnChain ? (
            <div className="text-xl font-bold text-blue-400">{formatEther(onChainPrice)} tFIL</div>
          ) : (
            <div className="text-sm font-medium text-gray-400">Not listed</div>
          )}
          <div className="text-xs text-gray-500">#{tokenId.toString()}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">{description}</p>

      {/* Audio Info */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
        <span>Duration: {formatDuration(duration)}</span>
        <span>Created: {createdAt}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={togglePlayback}
          disabled={audioGateways.length === 0}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors flex-1"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="text-sm font-medium">{isPlaying ? "Pause" : "Preview"}</span>
        </button>

        {isBuy ? (
          <button
            onClick={() => props.onBuy?.(props.listing)}
            disabled={props.isPending}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm font-medium">{props.isPending ? "Buying..." : "Buy"}</span>
          </button>
        ) : isListedOnChain ? (
          <button
            onClick={() => props.onCancel?.(props.owned)}
            disabled={props.isPending}
            className="flex items-center space-x-2 bg-red-500/80 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">{props.isPending ? "Cancelling..." : "Cancel"}</span>
          </button>
        ) : (
          <button
            onClick={() => props.onList?.(props.owned)}
            disabled={props.isPending}
            className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Tag className="w-4 h-4" />
            <span className="text-sm font-medium">List</span>
          </button>
        )}
      </div>

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  );
}
