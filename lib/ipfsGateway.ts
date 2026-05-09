// Tiny IPFS gateway helper. Listings store `audio_uri` and `tokenURI` as
// `ipfs://<cid>` strings; the UI must resolve those to HTTPS URLs and tolerate
// individual gateway failures.

export const IPFS_GATEWAYS = [
  "https://gateway.lighthouse.storage/ipfs/",
  "https://ipfs.io/ipfs/",
] as const;

const HTTP_PREFIX = /^https?:\/\//i;

function isHttpUrl(uri: string): boolean {
  return HTTP_PREFIX.test(uri);
}

function normalizeIpfsPath(uri: string): string | null {
  if (!uri) return null;
  let path = uri.trim();
  if (path.startsWith("ipfs://")) path = path.slice("ipfs://".length);
  if (path.startsWith("ipfs/")) path = path.slice("ipfs/".length);
  path = path.replace(/^\/+/, "");
  return path.length > 0 ? path : null;
}

export function normalizeIpfsUri(uri: string): string | null {
  if (!uri) return null;
  if (isHttpUrl(uri)) return uri;
  const path = normalizeIpfsPath(uri);
  return path ? `ipfs://${path}` : null;
}

/** Strip an `ipfs://` prefix and return the first gateway URL. */
export function ipfsToHttp(uri: string): string {
  if (!uri) return uri;
  if (isHttpUrl(uri)) return uri;
  const path = normalizeIpfsPath(uri);
  return path ? `${IPFS_GATEWAYS[0]}${path}` : uri;
}

/**
 * Strip an `ipfs://` prefix and return all candidate gateway URLs in priority
 * order. Useful for `<audio>`/`<img>` elements that need a fallback chain.
 */
export function ipfsToHttpAll(uri: string): string[] {
  if (!uri) return [];
  if (isHttpUrl(uri)) return [uri];
  const path = normalizeIpfsPath(uri);
  return path ? IPFS_GATEWAYS.map((g) => `${g}${path}`) : [];
}

/**
 * Fetch an IPFS URI through each configured gateway in turn, returning the
 * first non-error response. Throws when every gateway fails.
 */
export async function fetchFromIPFS(uri: string, init?: RequestInit): Promise<Response> {
  if (!uri) throw new Error("Missing IPFS URI");
  if (isHttpUrl(uri)) {
    const response = await fetch(uri, init);
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status} from ${uri}`);
  }
  const cid = normalizeIpfsPath(uri);
  if (!cid) throw new Error(`Invalid IPFS URI: ${uri}`);
  let lastError: unknown = null;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`, init);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} from ${gateway}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`All IPFS gateways failed for ${uri}`);
}
