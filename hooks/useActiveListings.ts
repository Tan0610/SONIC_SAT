"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { marketplaceConfig, nftConfig } from "@/lib/marketplaceContract";
import { fetchFromIPFS } from "@/lib/ipfsGateway";
import {
  validateListingMetadata,
  type ListingMetadata,
} from "@/lib/listingMetadata";

export type HydratedListing = {
  tokenId: bigint;
  seller: `0x${string}`;
  price: bigint;
  tokenURI: string;
  metadata: ListingMetadata | null;
};

const ACTIVE_PAGE_LIMIT = 50n;

type ActiveListingsTuple = readonly [
  readonly bigint[],
  readonly { seller: `0x${string}`; price: bigint; active: boolean }[]
];

/**
 * Reads up to 50 active marketplace listings, batches `tokenURI` lookups, and
 * hydrates each entry with its IPFS metadata document. Listings whose
 * metadata is missing or malformed surface as `metadata: null` so the renderer
 * can fall back to a placeholder rather than crashing.
 */
export function useActiveListings() {
  const {
    data: activeData,
    isLoading: isLoadingActive,
    error: activeError,
    refetch: refetchActive,
  } = useReadContract({
    ...marketplaceConfig,
    functionName: "getActiveListings",
    args: [0n, ACTIVE_PAGE_LIMIT],
  });

  const tuple = activeData as ActiveListingsTuple | undefined;
  const tokenIds = useMemo<readonly bigint[]>(() => tuple?.[0] ?? [], [tuple]);
  const onChainListings = useMemo(() => tuple?.[1] ?? [], [tuple]);

  const tokenURIQueries = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        ...nftConfig,
        functionName: "tokenURI" as const,
        args: [tokenId] as const,
      })),
    [tokenIds]
  );

  const {
    data: tokenURIData,
    isLoading: isLoadingTokenURIs,
    error: tokenURIError,
    refetch: refetchTokenURIs,
  } = useReadContracts({
    contracts: tokenURIQueries,
    query: { enabled: tokenIds.length > 0 },
  });

  const [metadataByURI, setMetadataByURI] = useState<Record<string, ListingMetadata>>({});
  const [failedMetadata, setFailedMetadata] = useState<Record<string, true>>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<Error | null>(null);

  const tokenURIs = useMemo(
    () =>
      (tokenURIData ?? []).map((entry) =>
        entry.status === "success" && typeof entry.result === "string"
          ? entry.result
          : ""
      ),
    [tokenURIData]
  );

  useEffect(() => {
    let cancelled = false;
    const fetchMissing = async () => {
      const uniqueURIs = Array.from(
        new Set(
          tokenURIs.filter(
            (uri) => uri && metadataByURI[uri] === undefined && failedMetadata[uri] !== true
          )
        )
      );
      if (uniqueURIs.length === 0) return;
      setIsLoadingMetadata(true);
      setMetadataError(null);
      try {
        const entries = await Promise.all(
          uniqueURIs.map(async (uri) => {
            try {
              const res = await fetchFromIPFS(uri);
              const json = await res.json();
              const validated = validateListingMetadata(json);
              if (!validated.valid) {
                console.warn(`Invalid metadata for ${uri}: ${validated.reason}`);
                return { uri, failed: true } as const;
              }
              return { uri, metadata: validated.value } as const;
            } catch (err) {
              console.warn(`Failed to fetch metadata for ${uri}:`, err);
              return { uri, failed: true } as const;
            }
          })
        );
        if (!cancelled) {
          setMetadataByURI((prev) => {
            const next = { ...prev };
            for (const entry of entries) {
              if ("metadata" in entry && entry.metadata !== undefined) {
                next[entry.uri] = entry.metadata;
              }
            }
            return next;
          });
          setFailedMetadata((prev) => {
            const next = { ...prev };
            for (const entry of entries) {
              if ("failed" in entry && entry.failed) next[entry.uri] = true;
            }
            return next;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setMetadataError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsLoadingMetadata(false);
      }
    };
    fetchMissing();
    return () => {
      cancelled = true;
    };
  }, [tokenURIs, metadataByURI, failedMetadata]);

  const listings = useMemo<HydratedListing[]>(() => {
    return tokenIds.map((tokenId, i) => {
      const onChain = onChainListings[i];
      const tokenURI = tokenURIs[i] ?? "";
      const meta = tokenURI ? metadataByURI[tokenURI] ?? null : null;
      return {
        tokenId,
        seller: onChain?.seller ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`),
        price: onChain?.price ?? 0n,
        tokenURI,
        metadata: meta,
      };
    });
  }, [tokenIds, onChainListings, tokenURIs, metadataByURI]);

  const refetch = useCallback(async () => {
    setFailedMetadata({});
    await Promise.all([refetchActive(), refetchTokenURIs()]);
  }, [refetchActive, refetchTokenURIs]);

  return {
    listings,
    isLoading: isLoadingActive || isLoadingTokenURIs || isLoadingMetadata,
    error: activeError ?? tokenURIError ?? metadataError ?? null,
    refetch,
  };
}
