/**
 * Adaptador S3 compatible — Fase 5.2 / 8.2
 * Firma para URLs prefirmadas, upload directo con checksum, confirmación server-side
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
 * Implementación fake para tests (sin red real)
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
      // URL firmada simulada con vencimiento
      const expires = Date.now() + 3600_000;
      return `https://fake-s3.test/${storageKey}?expires=${expires}&signature=fake`;
    },
  };
}
