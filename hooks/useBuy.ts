"use client";
import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Hex } from "viem";
import { marketplaceConfig } from "@/lib/marketplaceContract";

export function useBuy() {
  const config = useConfig();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buy = useCallback(
    async (tokenId: bigint, priceWei: bigint): Promise<Hex> => {
      setIsPending(true);
      setError(null);
      try {
        const hash = await writeContract(config, {
          ...marketplaceConfig,
          functionName: "buyToken",
          args: [tokenId],
          value: priceWei,
        });
        await waitForTransactionReceipt(config, { hash });
        return hash;
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

  return { buy, isPending, error };
}
