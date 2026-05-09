"use client";
import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Hex } from "viem";
import { marketplaceConfig, MARKETPLACE_ADDRESS, nftConfig } from "@/lib/marketplaceContract";

/** Approve + list an already-minted token. Used from /collection. */
export function useListExisting() {
  const config = useConfig();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const listExisting = useCallback(
    async (tokenId: bigint, priceWei: bigint): Promise<{ approveHash: Hex; listHash: Hex }> => {
      if (priceWei <= 0n) throw new Error("priceWei must be > 0");
      setIsPending(true);
      setError(null);
      try {
        const approveHash = await writeContract(config, {
          ...nftConfig,
          functionName: "approve",
          args: [MARKETPLACE_ADDRESS, tokenId],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });

        const listHash = await writeContract(config, {
          ...marketplaceConfig,
          functionName: "listToken",
          args: [tokenId, priceWei],
        });
        await waitForTransactionReceipt(config, { hash: listHash });

        return { approveHash, listHash };
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [config]
  );

  return { listExisting, isPending, error };
}
