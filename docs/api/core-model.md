# Core — Model

`src/core/model/types.ts` — barrel: `primitives.ts`, `inline.ts`, `block.ts`, `document.ts`. Exports `PortableDocument`, `BlockNode` (includes `columns`), `InlineNode`, `AssetRef`, `PageSettings`, `Selection`, ports.

`src/core/model/factories.ts` — `createDocument(opts)`, `createParagraph`, `createHeading`, `createText`, `createVariable`, `createEquation`, `createImageBlock`, `createTable`, `createColumns` with injected `IdGenerator`/`Clock`, defaults `A4 210x297mm`, `locale es-AR`.

See `src/core/model/*`.
