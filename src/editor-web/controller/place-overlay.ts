/** Position a floating overlay so it stays fully visible in the viewport. */

export function placeOverlay(anchor: HTMLElement, pop: HTMLElement, opts?: { gap?: number; pad?: number }): void {
  const gap = opts?.gap ?? 4;
  const pad = opts?.pad ?? 8;
  const doc = anchor.ownerDocument;
  const view = doc.defaultView;
  const vw = view?.innerWidth ?? 1024;
  const vh = view?.innerHeight ?? 768;
  if (pop.parentElement !== doc.body) doc.body.appendChild(pop);
  pop.hidden = false;
  pop.style.position = "fixed";
  pop.style.zIndex = pop.style.zIndex || "10000";
  pop.style.right = "auto";
  pop.style.bottom = "auto";
  pop.style.maxWidth = `${Math.max(160, vw - pad * 2)}px`;
  pop.style.visibility = "hidden";
  pop.style.left = `${pad}px`;
  pop.style.top = `${pad}px`;
  const ar = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const pw = Math.max(pr.width, pop.scrollWidth, pop.offsetWidth, 1);
  const ph = Math.max(pr.height, pop.scrollHeight, pop.offsetHeight, 1);
  let left = ar.right - pw;
  if (left < pad) left = ar.left;
  if (left + pw > vw - pad) left = vw - pad - pw;
  if (left < pad) left = pad;
  let top = ar.bottom + gap;
  if (top + ph > vh - pad) top = ar.top - gap - ph;
  if (top < pad) top = pad;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.style.visibility = "";
  const shown = pop.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (shown.right > vw - pad) dx -= shown.right - (vw - pad);
  if (shown.left + dx < pad) dx += pad - (shown.left + dx);
  if (shown.bottom > vh - pad) dy -= shown.bottom - (vh - pad);
  if (shown.top + dy < pad) dy += pad - (shown.top + dy);
  if (dx) pop.style.left = `${Math.round(left + dx)}px`;
  if (dy) pop.style.top = `${Math.round(top + dy)}px`;
}
