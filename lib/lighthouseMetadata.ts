// Wraps `@lighthouse-web3/sdk` to upload a serialised ListingMetadata blob.
// The audio file itself is uploaded separately by the seller flow before this
// helper runs — we only ever upload the small JSON document here.
import lighthouse from "@lighthouse-web3/sdk";
import type { ListingMetadata } from "./listingMetadata";

export async function uploadListingMetadata(
  meta: ListingMetadata,
  apiKey: string
): Promise<{ cid: string; uri: string }> {
  if (!apiKey) {
    throw new Error("Lighthouse API key is required to upload metadata");
  }
  const result = await lighthouse.uploadText(
    JSON.stringify(meta),
    apiKey,
    "metadata.json"
  );
  const cid = result?.data?.Hash;
  if (!cid) {
    throw new Error("Lighthouse uploadText returned no Hash");
  }
  return { cid, uri: `ipfs://${cid}` };
}
