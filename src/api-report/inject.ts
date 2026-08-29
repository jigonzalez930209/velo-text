function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    const next = cur[k];
    if (!next || typeof next !== "object" || Array.isArray(next)) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * Build the `data` map for `renderTemplate` / `exportDocument` from tag → value.
 * `customer.name` becomes `{ customer: { name } }`.
 */
export function dataFromSlotValues(values: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [tag, value] of Object.entries(values)) {
    if (tag.includes(".")) setPath(data, tag, value);
    else data[tag] = value;
  }
  return data;
}

/** Map image slot tags (`assetId`) to bytes the exporter already understands. */
export function assetsFromSlotValues(
  blobs: Record<string, { mediaType: string; data: Uint8Array }>,
): Record<string, { id: string; mediaType: string; data: Uint8Array }> {
  const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
  for (const [id, blob] of Object.entries(blobs)) {
    assets[id] = { id, mediaType: blob.mediaType, data: blob.data };
  }
  return assets;
}
