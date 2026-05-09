"use client";
import { useCallback, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { decodeEventLog, parseEventLogs, type Hex } from "viem";
import {
  marketplaceConfig,
  MARKETPLACE_ADDRESS,
  nftAbi,
  nftConfig,
} from "@/lib/marketplaceContract";
import { uploadListingMetadata } from "@/lib/lighthouseMetadata";
import type { ListingMetadata } from "@/lib/listingMetadata";

export type MintAndListArgs = {
  metadata: ListingMetadata;
  listForSale: boolean;
  priceWei?: bigint;
};

export type MintAndListResult = {
  tokenId: bigint;
  mintTxHash: Hex;
  listTxHash?: Hex;
};

/**
 * Orchestrates the seller flow: upload metadata JSON → mint NFT → optionally
 * approve + list on the marketplace. Returns the new tokenId parsed from the
 * `Minted` event.
 */
export function useMintAndList() {
  const { address } = useAccount();
  const config = useConfig();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mintAndList = useCallback(
    async ({ metadata, listForSale, priceWei }: MintAndListArgs): Promise<MintAndListResult> => {
      if (!address) throw new Error("Wallet not connected");
      if (listForSale && (!priceWei || priceWei <= 0n)) {
        throw new Error("priceWei must be > 0 when listForSale is true");
      }

      setIsPending(true);
      setError(null);
      try {
        const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY;
        if (!apiKey) {
          throw new Error("NEXT_PUBLIC_LIGHTHOUSE_API_KEY is not configured");
        }

        const { uri: tokenURI } = await uploadListingMetadata(metadata, apiKey);

        const mintTxHash = await writeContract(config, {
          ...nftConfig,
          functionName: "mint",
          args: [address, tokenURI],
        });
        const mintReceipt = await waitForTransactionReceipt(config, { hash: mintTxHash });

        // Find the Minted event to extract the newly assigned tokenId.
        let tokenId: bigint | undefined;
        const minted = parseEventLogs({
          abi: nftAbi,
          eventName: "Minted",
          logs: mintReceipt.logs,
        });
        if (minted.length > 0) {
          tokenId = minted[0].args.tokenId as bigint;
        } else {
          // Fallback: scan logs manually with decodeEventLog
          for (const log of mintReceipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: nftAbi,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "Minted") {
                tokenId = (decoded.args as { tokenId: bigint }).tokenId;
                break;
              }
            } catch {
              // not our event, ignore
            }
          }
        }
        if (tokenId === undefined) {
          throw new Error("Mint succeeded but Minted event was not found in receipt logs");
        }

        let listTxHash: Hex | undefined;
        if (listForSale && priceWei && priceWei > 0n) {
          const approveHash = await writeContract(config, {
            ...nftConfig,
            functionName: "approve",
            args: [MARKETPLACE_ADDRESS, tokenId],
          });
          await waitForTransactionReceipt(config, { hash: approveHash });

          listTxHash = await writeContract(config, {
            ...marketplaceConfig,
            functionName: "listToken",
            args: [tokenId, priceWei],
          });
          await waitForTransactionReceipt(config, { hash: listTxHash });
        }

        return { tokenId, mintTxHash, listTxHash };
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [address, config]
  );

  return { mintAndList, isPending, error };
}
