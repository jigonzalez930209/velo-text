/** Demo raster + SVG bytes for the docs playground (browser only). */
export function samplePngBytes(): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 80;
  const g = canvas.getContext("2d");
  if (!g) return new Uint8Array();
  g.fillStyle = "#3659e3";
  g.fillRect(0, 0, 240, 80);
  g.fillStyle = "#ffffff";
  g.font = "600 18px system-ui,sans-serif";
  g.fillText("PNG sample", 20, 48);
  const b64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function sampleSvgBytes(label: string, fill: string): Uint8Array {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <rect width="200" height="80" rx="12" fill="${fill}"/>
  <circle cx="28" cy="40" r="12" fill="#fff" opacity="0.9"/>
  <text x="52" y="46" fill="#fff" font-size="18" font-family="system-ui,sans-serif">${label}</text>
</svg>`;
  return new TextEncoder().encode(svg);
}
