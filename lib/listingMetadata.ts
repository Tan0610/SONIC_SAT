// Pinned listing metadata schema — `tokenURI` resolves to a JSON document
// matching `ListingMetadata`. Producers MUST emit `schema_version: 1` and the
// builder normalises the rest. Renderers MUST tolerate missing optional fields.

import { normalizeIpfsUri } from "@/lib/ipfsGateway";

export type ListingMetadata = {
  schema_version: 1;
  name: string;
  description: string;
  audio_cid: string;
  audio_uri: string;
  mime_type?: string;
  duration_seconds: number;
  size_bytes: number;
  creator: `0x${string}`;
  created_at: string;
  price_hint?: { amount: string; currency: "tFIL" };
};

export type BuildListingMetadataInput = {
  name: string;
  description: string;
  audio_cid: string;
  mime_type?: string;
  duration_seconds: number;
  size_bytes: number;
  creator: `0x${string}`;
  price_hint?: { amount: string; currency: "tFIL" };
};

export function buildListingMetadata(input: BuildListingMetadataInput): ListingMetadata {
  return {
    schema_version: 1,
    name: input.name,
    description: input.description ?? "",
    audio_cid: input.audio_cid,
    audio_uri: `ipfs://${input.audio_cid}`,
    mime_type: input.mime_type ?? "audio/webm",
    duration_seconds: Math.max(0, Math.floor(input.duration_seconds)),
    size_bytes: Math.max(0, Math.floor(input.size_bytes)),
    creator: input.creator,
    created_at: new Date().toISOString(),
    ...(input.price_hint ? { price_hint: input.price_hint } : {}),
  };
}

type ValidationResult =
  | { valid: true; value: ListingMetadata }
  | { valid: false; reason: string };

function isHexAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function coerceNonNegativeNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, num);
}

function stripIpfsPrefix(value: string): string {
  let out = value.trim();
  if (out.startsWith("ipfs://")) out = out.slice("ipfs://".length);
  if (out.startsWith("ipfs/")) out = out.slice("ipfs/".length);
  return out.replace(/^\/+/, "");
}

export function validateListingMetadata(value: unknown): ValidationResult {
  if (!value || typeof value !== "object") {
    return { valid: false, reason: "metadata must be an object" };
  }
  const v = value as Record<string, unknown>;

  const schemaVersion =
    typeof v.schema_version === "number"
      ? v.schema_version
      : typeof v.schema_version === "string"
        ? Number(v.schema_version)
        : Number.NaN;
  if (schemaVersion !== 1) {
    return { valid: false, reason: `unsupported schema_version: ${String(v.schema_version)}` };
  }
  if (typeof v.name !== "string" || v.name.length < 1 || v.name.length > 120) {
    return { valid: false, reason: "name must be a string of length 1..120" };
  }
  const name = v.name as string;
  const description = typeof v.description === "string" ? v.description : "";
  if (description.length > 2000) {
    return { valid: false, reason: "description must be a string of length 0..2000" };
  }
  const audioCidRaw = typeof v.audio_cid === "string" ? stripIpfsPrefix(v.audio_cid) : "";
  if (audioCidRaw.length === 0) {
    return { valid: false, reason: "audio_cid must be a non-empty string" };
  }
  const normalizedAudioUri =
    typeof v.audio_uri === "string" ? normalizeIpfsUri(v.audio_uri) : null;
  const audioUri = normalizedAudioUri ?? normalizeIpfsUri(`ipfs://${audioCidRaw}`);
  if (!audioUri) {
    return { valid: false, reason: "audio_uri could not be normalized" };
  }
  const mimeType = typeof v.mime_type === "string" && v.mime_type.length > 0 ? v.mime_type : undefined;
  const durationSeconds = coerceNonNegativeNumber(v.duration_seconds, 0);
  const sizeBytes = coerceNonNegativeNumber(v.size_bytes, 0);
  if (!isHexAddress(v.creator)) {
    return { valid: false, reason: "creator must be a 0x-prefixed 20-byte hex address" };
  }
  const creator = v.creator as `0x${string}`;
  const createdAt =
    typeof v.created_at === "string" && !Number.isNaN(Date.parse(v.created_at))
      ? v.created_at
      : "";
  let priceHint: ListingMetadata["price_hint"] | undefined;
  if (v.price_hint !== undefined) {
    const ph = v.price_hint as Record<string, unknown> | null;
    if (ph && typeof ph === "object" && typeof ph.amount === "string" && ph.currency === "tFIL") {
      priceHint = { amount: ph.amount, currency: "tFIL" };
    }
  }

  return {
    valid: true,
    value: {
      schema_version: 1,
      name,
      description,
      audio_cid: audioCidRaw,
      audio_uri: audioUri,
      mime_type: mimeType,
      duration_seconds: durationSeconds,
      size_bytes: sizeBytes,
      creator,
      created_at: createdAt,
      ...(priceHint ? { price_hint: priceHint } : {}),
    },
  };
}
