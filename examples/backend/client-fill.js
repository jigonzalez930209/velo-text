/**
 * Browser: send the editor AST + the values for every {{tag}}.
 * Works with the Vite plugin, Express, or Vercel — same JSON body.
 */
export async function fillTagsToPdf(document, data, assets) {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ document, data, assets }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
