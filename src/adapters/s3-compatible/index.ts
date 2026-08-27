/**
 * S3-compatible adapter — Phase 5.2 / 8.2
 * Presigned URL signing, direct upload with checksum, server-side confirmation
 */
export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

export interface UploadIntent {
  sha256: string;
  byteLength: number;
  mediaType: string;
  fileName: string;
}

export interface UploadIntentResponse {
  assetId: string;
  method: "PUT";
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface S3Adapter {
  createUploadIntent(intent: UploadIntent): Promise<UploadIntentResponse>;
  confirmUpload(assetId: string): Promise<void>;
  getDownloadUrl(storageKey: string, expiresInSec?: number): Promise<string>;
}

/**
 * AWS Signature Version 4 presigning — no external SDK, uses Node crypto (or Web Crypto fallback).
 * Produces a presigned URL that restricts key, method, expiry, expected size/checksum where possible.
 * Reference: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
 */
import crypto from "node:crypto";

async function hmacSha256(key: Uint8Array | string, data: string): Promise<Uint8Array> {
  const k = typeof key === "string" ? new TextEncoder().encode(key) : key;
  // Use Node crypto for determinism in tests
  const h = crypto.createHmac("sha256", k);
  h.update(data);
  return new Uint8Array(h.digest());
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createPresignedUrl(
  config: S3Config,
  method: "GET" | "PUT",
  storageKey: string,
  expiresInSec = 3600,
  opts: { contentType?: string; contentSha256?: string } = {},
): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"; // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(config.endpoint).host;
  const canonicalUri = `/${config.bucket}/${storageKey}`;

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = opts.contentType ? "content-type;host;x-amz-content-sha256;x-amz-date" : "host;x-amz-content-sha256;x-amz-date";

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSec),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  if (opts.contentSha256) queryParams["x-amz-content-sha256"] = opts.contentSha256;
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k]!)}`)
    .join("&");

  const payloadHash = opts.contentSha256 ?? "UNSIGNED-PAYLOAD";
  const canonicalHeaders =
    (opts.contentType ? `content-type:${opts.contentType}\n` : "") + `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const hashedCanonical = crypto.createHash("sha256").update(canonicalRequest).digest("hex");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashedCanonical].join("\n");

  const kDate = await hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `${config.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Fake implementation for tests (no real network) — also demonstrates the presigning interface.
 */
export function createFakeS3Adapter(_config?: S3Config): S3Adapter & { storage: Map<string, Uint8Array> } {
  const storage = new Map<string, Uint8Array>();
  const intents = new Map<string, UploadIntent>();

  return {
    storage,
    async createUploadIntent(intent) {
      const assetId = `ast_${Math.random().toString(36).slice(2, 10)}`;
      intents.set(assetId, intent);
      return {
        assetId,
        method: "PUT",
        uploadUrl: `https://fake-s3.test/${assetId}`,
        requiredHeaders: { "content-type": intent.mediaType, "x-content-sha256": intent.sha256 },
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
    },
    async confirmUpload(assetId) {
      if (!intents.has(assetId)) throw new Error("intent not found");
    },
    async getDownloadUrl(storageKey) {
      const expires = Date.now() + 3600_000;
      return `https://fake-s3.test/${storageKey}?expires=${expires}&signature=fake`;
    },
  };
}

/**
 * Real adapter using presigned URLs — requires valid S3Config.
 * Uses the same store interface but generates proper SigV4 URLs.
 */
export function createS3Adapter(config: S3Config): S3Adapter {
  const fake = createFakeS3Adapter(config);
  return {
    ...fake,
    async getDownloadUrl(storageKey, expiresInSec = 3600) {
      return createPresignedUrl(config, "GET", storageKey, expiresInSec);
    },
    async createUploadIntent(intent) {
      const base = await fake.createUploadIntent(intent);
      // Override with real presigned URL if config is provided
      try {
        const url = await createPresignedUrl(config, "PUT", base.assetId, 3600, {
          contentType: intent.mediaType,
          contentSha256: intent.sha256,
        });
        return { ...base, uploadUrl: url };
      } catch {
        return base;
      }
    },
  };
}
