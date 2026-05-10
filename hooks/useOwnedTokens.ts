"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { parseAbiItem, type PublicClient } from "viem";
import {
  DEPLOY_BLOCK,
  NFT_ADDRESS,
  marketplaceConfig,
  nftConfig,
} from "@/lib/marketplaceContract";
import { fetchFromIPFS } from "@/lib/ipfsGateway";
import {
  validateListingMetadata,
  type ListingMetadata,
} from "@/lib/listingMetadata";

export type OwnedToken = {
  tokenId: bigint;
  tokenURI: string;
  metadata: ListingMetadata | null;
  listing: { active: boolean; price: bigint; seller: `0x${string}` };
};

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);
const SCAN_WINDOW = 10000n;

async function scanOwnedTokenIds(
  client: PublicClient,
  account: `0x${string}`
): Promise<bigint[]> {
  const latest = await client.getBlockNumber();
  const fromMap = new Map<bigint, { block: bigint; index: number; isReceive: boolean }>();

  // Walk both incoming and outgoing transfers in chronological order so we end
  // up with the *latest* state for each tokenId. We scan in 10k-block windows
  // to stay under Calibration RPC log limits.
  let cursor = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : 0n;
  while (cursor <= latest) {
    const toBlock = cursor + SCAN_WINDOW - 1n > latest ? latest : cursor + SCAN_WINDOW - 1n;
    const [incoming, outgoing] = await Promise.all([
      client.getLogs({
        address: NFT_ADDRESS,
        event: TRANSFER_EVENT,
        args: { to: account },
        fromBlock: cursor,
        toBlock,
      }),
      client.getLogs({
        address: NFT_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: account },
        fromBlock: cursor,
        toBlock,
      }),
    ]);

    for (const log of incoming) {
      const tokenId = log.args.tokenId;
      if (tokenId === undefined) continue;
      const prev = fromMap.get(tokenId);
      const cmp =
        !prev ||
        log.blockNumber! > prev.block ||
        (log.blockNumber! === prev.block && log.logIndex! > prev.index);
      if (cmp) {
        fromMap.set(tokenId, {
          block: log.blockNumber!,
          index: log.logIndex!,
          isReceive: true,
        });
      }
    }
    for (const log of outgoing) {
      const tokenId = log.args.tokenId;
      if (tokenId === undefined) continue;
      const prev = fromMap.get(tokenId);
      const cmp =
        !prev ||
        log.blockNumber! > prev.block ||
        (log.blockNumber! === prev.block && log.logIndex! > prev.index);
      if (cmp) {
        fromMap.set(tokenId, {
          block: log.blockNumber!,
          index: log.logIndex!,
          isReceive: false,
        });
      }
    }

    if (toBlock === latest) break;
    cursor = toBlock + 1n;
  }

  const owned: bigint[] = [];
  for (const [tokenId, entry] of fromMap.entries()) {
    if (entry.isReceive) owned.push(tokenId);
  }
  owned.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return owned;
}

export function useOwnedTokens() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<Error | null>(null);
  const [scanNonce, setScanNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!address || !publicClient) {
        setTokenIds([]);
        return;
      }
      setIsScanning(true);
      setScanError(null);
      try {
        const ids = await scanOwnedTokenIds(publicClient as PublicClient, address);
        if (!cancelled) setTokenIds(ids);
      } catch (err) {
        if (!cancelled) {
          setScanError(err instanceof Error ? err : new Error(String(err)));
          setTokenIds([]);
        }
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, scanNonce]);

  const tokenURIQueries = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        ...nftConfig,
        functionName: "tokenURI" as const,
        args: [tokenId] as const,
      })),
    [tokenIds]
  );
  const listingQueries = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        ...marketplaceConfig,
        functionName: "getListing" as const,
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
  const {
    data: listingData,
    isLoading: isLoadingListings,
    error: listingError,
    refetch: refetchListings,
  } = useReadContracts({
    contracts: listingQueries,
    query: { enabled: tokenIds.length > 0 },
  });

  const tokenURIs = useMemo(
    () =>
      (tokenURIData ?? []).map((entry) =>
        entry.status === "success" && typeof entry.result === "string"
          ? entry.result
          : ""
      ),
    [tokenURIData]
  );

  const [metadataByURI, setMetadataByURI] = useState<Record<string, ListingMetadata>>({});
  const [failedMetadata, setFailedMetadata] = useState<Record<string, true>>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
    run();
    return () => {
      cancelled = true;
    };
  }, [tokenURIs, metadataByURI, failedMetadata]);

  const owned = useMemo<OwnedToken[]>(() => {
    return tokenIds.map((tokenId, i) => {
      const tokenURI = tokenURIs[i] ?? "";
      const meta = tokenURI ? metadataByURI[tokenURI] ?? null : null;
      const rawListing = listingData?.[i];
      const listing =
        rawListing?.status === "success" && rawListing.result
          ? (rawListing.result as { seller: `0x${string}`; price: bigint; active: boolean })
          : { seller: "0x0000000000000000000000000000000000000000" as `0x${string}`, price: 0n, active: false };
      return {
        tokenId,
        tokenURI,
        metadata: meta,
        listing: { active: listing.active, price: listing.price, seller: listing.seller },
      };
    });
  }, [tokenIds, tokenURIs, listingData, metadataByURI]);

  const refetch = useCallback(async () => {
    setScanNonce((n) => n + 1);
    setFailedMetadata({});
    await Promise.all([refetchTokenURIs(), refetchListings()]);
  }, [refetchTokenURIs, refetchListings]);

  return {
    owned,
    isLoading: isScanning || isLoadingTokenURIs || isLoadingListings || isLoadingMetadata,
    error: scanError ?? tokenURIError ?? listingError ?? metadataError ?? null,
    refetch,
  };
}
