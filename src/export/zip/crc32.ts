/**
 * CRC-32 — Fase 10.6
 * Implementación propia sin dependencias
 */
const TABLE = new Uint32Array(256);
(function init(): void {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[i] = c >>> 0;
  }
})();

export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
