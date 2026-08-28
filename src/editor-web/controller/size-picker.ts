export interface SizePickerOpts {
  cols: number;
  rows: number;
  label: (cols: number, rows: number) => string;
  onPick: (cols: number, rows: number) => void;
  footer?: { label: string; onClick: () => void };
}

/** Word-style hover grid. `cols`/`rows` in onPick are 1-based selected size. */
export function openSizePicker(anchor: HTMLElement, opts: SizePickerOpts): () => void {
  const doc = anchor.ownerDocument;
  closeSizePickers(doc);
  const pop = doc.createElement("div");
  pop.className = "pde-size-picker";
  pop.setAttribute("role", "dialog");
  const title = doc.createElement("div");
  title.className = "pde-size-picker-label";
  title.textContent = opts.label(1, 1);
  const grid = doc.createElement("div");
  grid.className = "pde-size-picker-grid";
  grid.style.gridTemplateColumns = `repeat(${opts.cols}, 18px)`;
  const cells: HTMLButtonElement[] = [];
  let hoverC = 1;
  let hoverR = 1;
  const paint = (c: number, r: number): void => {
    hoverC = c;
    hoverR = r;
    title.textContent = opts.label(c, r);
    cells.forEach((btn) => {
      const cc = Number(btn.dataset.c);
      const rr = Number(btn.dataset.r);
      btn.classList.toggle("is-on", cc <= c && rr <= r);
    });
  };
  for (let r = 1; r <= opts.rows; r++) {
    for (let c = 1; c <= opts.cols; c++) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "pde-size-cell";
      b.dataset.c = String(c);
      b.dataset.r = String(r);
      b.setAttribute("aria-label", opts.label(c, r));
      b.onmouseenter = () => paint(c, r);
      b.onclick = (ev) => {
        ev.preventDefault();
        opts.onPick(c, r);
        pop.remove();
      };
      cells.push(b);
      grid.appendChild(b);
    }
  }
  pop.appendChild(title);
  pop.appendChild(grid);
  if (opts.footer) {
    const foot = doc.createElement("button");
    foot.type = "button";
    foot.className = "pde-size-picker-foot";
    foot.textContent = opts.footer.label;
    foot.onclick = () => {
      pop.remove();
      opts.footer!.onClick();
    };
    pop.appendChild(foot);
  }
  paint(1, 1);
  placePop(anchor, pop);
  doc.body.appendChild(pop);
  const onDoc = (ev: Event): void => {
    const t = ev.target as Node | null;
    if (pop.contains(t) || anchor.contains(t)) return;
    pop.remove();
    doc.removeEventListener("mousedown", onDoc, true);
  };
  doc.addEventListener("mousedown", onDoc, true);
  return () => {
    pop.remove();
    doc.removeEventListener("mousedown", onDoc, true);
  };
}

export interface MosaicPickerOpts {
  presets: Array<{ label: string; pcts: number[] }>;
  onPreset: (pcts: number[]) => void;
  onMosaic: (counts: number[]) => void;
}

/** Up to 3 rows; each row is 2–4 columns (or skipped). */
export function openMosaicPicker(anchor: HTMLElement, opts: MosaicPickerOpts): () => void {
  const doc = anchor.ownerDocument;
  closeSizePickers(doc);
  const pop = doc.createElement("div");
  pop.className = "pde-size-picker pde-mosaic-picker";
  const title = doc.createElement("div");
  title.className = "pde-size-picker-label";
  title.textContent = "Column layout";
  pop.appendChild(title);
  for (const preset of opts.presets) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "pde-mosaic-preset";
    b.innerHTML = `<span class="pde-preset-bars">${preset.pcts.map((p) => `<i style="flex:${p}"></i>`).join("")}</span><span>${preset.label}</span>`;
    b.onclick = () => {
      opts.onPreset(preset.pcts);
      pop.remove();
    };
    pop.appendChild(b);
  }
  const sub = doc.createElement("div");
  sub.className = "pde-menu-title";
  sub.textContent = "Mosaic (up to 3 rows)";
  pop.appendChild(sub);
  const counts = [0, 0, 0];
  const status = doc.createElement("div");
  status.className = "pde-size-picker-label";
  const paintStatus = (): void => {
    status.textContent = counts.map((n, i) => `Row ${i + 1}: ${n >= 2 ? n : "skip"}`).join(" · ");
  };
  for (let row = 0; row < 3; row++) {
    const line = doc.createElement("div");
    line.className = "pde-mosaic-row";
    const lab = doc.createElement("span");
    lab.textContent = `R${row + 1}`;
    line.appendChild(lab);
    const cells: HTMLButtonElement[] = [];
    const paint = (n: number): void => {
      counts[row] = n;
      cells.forEach((btn, i) => btn.classList.toggle("is-on", i < n));
      paintStatus();
    };
    for (let n = 1; n <= 4; n++) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "pde-size-cell";
      b.setAttribute("aria-label", `Row ${row + 1}: ${n === 1 ? "skip" : `${n} columns`}`);
      b.onmouseenter = () => {
        cells.forEach((btn, i) => btn.classList.toggle("is-on", i < (n === 1 ? 0 : n)));
      };
      b.onmouseleave = () => {
        cells.forEach((btn, i) => btn.classList.toggle("is-on", i < counts[row]!));
      };
      b.onclick = (ev) => {
        ev.preventDefault();
        paint(n === 1 ? 0 : n);
      };
      cells.push(b);
      line.appendChild(b);
    }
    pop.appendChild(line);
  }
  paintStatus();
  pop.appendChild(status);
  const insert = doc.createElement("button");
  insert.type = "button";
  insert.className = "pde-size-picker-foot";
  insert.textContent = "Insert mosaic";
  insert.onclick = () => {
    const rows = counts.filter((n) => n >= 2);
    if (!rows.length) return;
    opts.onMosaic(rows);
    pop.remove();
  };
  pop.appendChild(insert);
  placePop(anchor, pop);
  doc.body.appendChild(pop);
  const onDoc = (ev: Event): void => {
    const t = ev.target as Node | null;
    if (pop.contains(t) || anchor.contains(t)) return;
    pop.remove();
    doc.removeEventListener("mousedown", onDoc, true);
  };
  doc.addEventListener("mousedown", onDoc, true);
  return () => {
    pop.remove();
    doc.removeEventListener("mousedown", onDoc, true);
  };
}

function placePop(anchor: HTMLElement, pop: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.round(r.left)}px`;
  pop.style.top = `${Math.round(r.bottom + 4)}px`;
}

export function closeSizePickers(doc: Document): void {
  for (const el of Array.from(doc.querySelectorAll(".pde-size-picker"))) el.remove();
}

export function clampTableSize(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.min(4, Math.round(cols) || 1)),
    rows: Math.max(1, Math.min(10, Math.round(rows) || 1)),
  };
}
