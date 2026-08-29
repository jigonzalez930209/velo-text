# Backend slots (`velo-text/api-report`)

Optional **Node/server** entry. It does **not** import the editor, PDF/ODT/DOCX writers, or any npm dependency. The browser must not load this module (and must not load `velo-text/export` or `velo-text/backend`) if you care about payload size.

We will not add Puppeteer, LibreOffice WASM, pdf-lib, or anything over **~2 MB gzip**. Fill and export stay on the AST + our writers.

The generated catalog of public names is [API report](/api-report). This entry is the **slot map** for those node types.

## Front vs back

| App | Import |
| --- | --- |
| Editor UI | `velo-text/vanilla` or `velo-text/editor-web` + theme CSS |
| Fill tags + export | `velo-text/api-report` + `velo-text/export` + `velo-text/backend` |

Do not `import from "velo-text"` on the server if you want to keep the editor out of the graph; the main barrel still re-exports the host.

## Tags

Same identifiers the editor already stores:

| Slot `kind` | `tag` |
| --- | --- |
| `variable` | `path` (`customer.name`) |
| `image` / `inline-image` | `assetId` |
| `table` | `repeat.path` if present, else node id |
| `table-repeat` | `repeat.path` (collection for cloned rows) |
| `equation` / `equation-block` | node id (`latex` on the slot) |
| `columns` | node id |

`pointer` is a JSON-pointer-like path into the AST (`/root/children/0/...`) so a host can show “this field is the first paragraph variable”.

## Fill

```ts
import { reportSlots, dataFromSlotValues, assetsFromSlotValues } from "velo-text/api-report";
import { exportDocument } from "velo-text/export";
import { createBufferSink } from "velo-text/backend";

const slots = reportSlots(document);
// slots → your form / job: values keyed by slot.tag

const data = dataFromSlotValues({
  "customer.name": "Ada",
  items: [{ name: "Widget" }],
});
const assets = assetsFromSlotValues({
  logo: { mediaType: "image/png", data: pngBytes },
});

const { sink } = createBufferSink();
await exportDocument({ document, data, assets, format: "pdf", sink });
```

The pixel-true preview is `previewPdf` (same `exportPdf` as the API). `reportSlots` only lists inject tags.
