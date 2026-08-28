# Roadmap: usabilidad y adaptadores de frameworks

**Versión:** 1.0  
**Fecha:** 27 de agosto de 2026  
**Base:** [roadmap_editor_documental_portable.md](./roadmap_editor_documental_portable.md) (núcleo v1 ya en gran parte implementado).  
**Objetivo:** que un usuario no-técnico sienta el editor como un producto, no como un AST con toolbar; y que un equipo pueda montarlo en Vue, React, Svelte, Vanilla, Angular o Astro **sin tocar el core**.

**Regla:** cero dependencias runtime en `velo-text`. Los adaptadores de framework viven en paquetes o carpetas `adapters/*` y **solo** dependen del framework host + de esta biblioteca. El core no importa React/Vue/etc.

**Leyenda:** `[ ]` pendiente · `[~]` hay ganchos · `[x]` hecho.

---

## Principios

1. Cada feature termina en el playground **y** en al menos un adaptador (Vanilla).
2. El AST sigue siendo la fuente de verdad; la UI no introduce un segundo documento.
3. No se abre un motor de colaboración, import Word, ni un CMS. Eso sigue fuera de v1.
4. Archivos fuente ≤ 250 líneas; APIs nuevas mínimas (`commands.*` o un host opcional).

---

## Orden sugerido

Usabilidad 1 → 2 → 3 → 7 → 5 → 4 → 6 → 10 → 8 → 9, en paralelo con **Vanilla oficial** y luego React → Vue → Svelte → Angular → Astro.

---

# Track A — 10 features de usabilidad

## 1. Paleta de comandos y slash menu — `[x]`

**Por qué:** hoy hay que cazar el botón; Lexical/Notion ganan por ` / ` y `Ctrl+K`.

**Qué:**
- `Ctrl/Cmd+K` abre paleta filtrable (bloques, marcas, insert tabla/columnas/imagen/variable/ecuación, undo).
- En párrafo vacío, `/` abre el mismo catálogo anclado al caret.
- Items existentes reutilizan `editor.commands.*` (tabla 4×10 y mosaico de columnas ya existen).

**Aceptación:** con teclado solo se inserta H2, tabla 3×2 y variable `{{name}}` sin usar la toolbar.

**No:** plugin marketplace, IA, comandos de usuario persistidos.

---

## 2. Toolbar flotante de selección — `[x]`

**Por qué:** ir a la barra superior rompe el flujo de lectura.

**Qué:**
- Al seleccionar texto, bubble cerca del rango: bold/italic/underline/link/clear.
- No cubre el caret; se cierra al colapsar la selección o Escape.
- En celda o columna, las acciones de bloque (tabla/columnas) **no** se meten en la bubble (siguen en el chrome del bloque).

**Aceptación:** seleccionar “Widget” en una celda, negrita, y el handle de columna no salta.

**No:** color picker completo en v1 de esta feature (eso es §4 del backlog de núcleo: marcas `color`/`fontSizePt` sin UI).

---

## 3. Chips de variable y popover de enlace — `[x]`

**Por qué:** las variables son atómicas pero no se **editan**; los links existen en el modelo y casi no en el editor.

**Qué:**
- Clic en `{{path}}`: popover path / format / fallback / vista previa con `data` del host.
- Insertar/editar `link` (href allowlist `https:`/`mailto:`/`#`), quitar enlace.
- Catálogo de variables del `variableSchema` o de un `getVariableCatalog()` opcional.

**Aceptación:** cambiar `{{name}}` a `{{customer.name}}` sin reescribir JSON; crear un link y exportar **PDF** con el texto del href (hipervínculo nativo PDF es limitado en v1).

**No:** bindings bidireccionales ni fórmulas tipo Excel.

---

## 4. Buscar y reemplazar — `[x]`

**Por qué:** documentos de plantilla largos son inutilizables sin Find.

**Qué:**
- `Ctrl/Cmd+F` / `H`: coincidencias en texto (no dentro de latex crudo si se puede evitar).
- Resaltar en el DOM; siguiente/anterior; reemplazar una/todas en nodos `text` (variables se saltan o se piden confirmar).
- Contador de matches.

**Aceptación:** 20 párrafos, buscar “Item”, reemplazar 3 de 5, undo restaura.

**No:** regex avanzado, buscar en PDF exportado.

---

## 5. Vista previa de plantilla (datos ↔ documento) — `[x]`

**Por qué:** el JSON de “Template data” del playground es de desarrollador, no de usuario.

**Qué:**
- Panel **Preview** que materializa con `renderTemplate` / pipeline de export (mismo resolver seguro).
- Toggle Editor | Preview | Split.
- Lista de variables no resueltas (diagnósticos ya existen en template).

**Aceptación:** cambiar `total` en datos y ver moneda en preview sin exportar.

**No:** editor de JSON schema visual; Excel live.

---

## 6. Mapa del documento (outline) — `[x]`

**Por qué:** headings ya están; no hay navegación.

**Qué:**
- Panel con H1–H3 clickeables; scroll/focus al bloque.
- Indicador de bloque activo según caret.
- Arrastrar heading en el outline **opcional fase 2** (hoy ya hay reorder por handle).

**Aceptación:** 6 headings, clic en el tercero mueve el viewport y el caret.

**No:** TOC en el PDF (eso es export; se puede listar después).

---

## 7. Imágenes como objeto de producto — `[x]`

**Por qué:** hay file picker y resize; falta el gesto que la gente espera.

**Qué:**
- Drag-and-drop de archivo sobre el editor o un hueco “Drop image”.
- Alt obligatorio o aviso a11y (ya hay `validateImageAlt`).
- Reemplazar asset, caption opcional (párrafo bajo o campo del nodo si se añade con migración).
- Progreso / error de sniff (tipo no permitido).

**Aceptación:** soltar un PNG, verlo, editar alt, exportar PDF con imagen.

**No:** recorte bitmap, filtros, galería DAM.

---

## 8. Vista de página (print preview) — `[x]`

**Por qué:** el salto de página es un nodo; el usuario no ve márgenes ni “cómo sale el PDF”.

**Qué:**
- Modo página usando `page` del documento (width/height/margins) y el layout ya existente (no un segundo motor).
- Overlay de márgenes; indicador de overflow (diagnósticos de paginación).
- No hace falta pixel-perfect vs Word.

**Aceptación:** activar preview, ver al menos 1 salto en un doc con `page-break`; export PDF no cambia el AST.

**No:** motor de impresión nativo del OS; headers/footers Word-complete.

---

## 9. Autosave, conflicto y restaurar — `[x]`

**Por qué:** el contrato PG ya tiene revisiones; el editor no las usa.

**Qué:**
- Host callback `onChange` ya existe: debounce autosave.
- UI: “Guardado / Sin conexión / Conflicto (revisión X)”.
- Lista corta de revisiones + restore (`DocumentRepository.restore` cuando el host lo inyecte).
- Sin host: `localStorage` o IndexedDB **solo en playground**, no en el core.

**Aceptación:** playground recarga y recupera el último doc; con repo in-memory, restore a revisión N.

**No:** CRDT, presencia, comentarios.

---

## 10. Teclado, táctil y honestidad a11y — `[x]`

**Por qué:** hay atajos y contraste helper; no hay mapa ni toolbar usable en 390px.

**Qué:**
- Hoja `?` con atajos reales (`Mod+b`, undo, paleta, find).
- Toolbar compacta / overflow en viewport estrecho; bubble (feature 2) como primario en móvil.
- Foco visible en handles de tabla/columnas; `aria` en paleta y pickers (la grilla 4×10 ya tiene labels).
- Matriz mínima: Chromium + un WebKit; IME documentado (composing ya se respeta).

**Aceptación:** en 390×844 se inserta tabla y se escribe en una celda; Tab recorre toolbar.

**No:** app nativa, Apple Pencil.

---

# Track B — Adaptadores de frameworks

Contrato común (todos igual):

```ts
type EditorHandle = {
  getDocument(): PortableDocument;
  setDocument(doc: PortableDocument): void;
  setTheme(theme: ThemeName): void;
  commands: Editor["commands"];
  destroy(): void;
};
```

Props/atributos mínimos: `document`, `theme`, `editable`, `onChange`, `resolveAssetUrl`. El host monta un `HTMLElement` y llama `createEditor`.

**Fuera:** reimplementar el reconciler en VDOM. El DOM del editor sigue siendo `contenteditable` interno.

| Adaptador | Estado | Entrega |
| --- | --- | --- |
| Vanilla | `[x]` | `mountVanillaEditor` + `examples/vanilla/index.html` |
| React | `[x]` | `examples/react/PortableEditor.jsx` |
| Vue | `[x]` | `examples/vue/PortableEditor.vue` |
| Svelte | `[x]` | `examples/svelte/portableEditor.js` action |
| Angular | `[x]` | `examples/angular/portable-editor.ts` standalone directive |
| Astro | `[x]` | `examples/astro/PortableEditor.astro` `client:load`; editor client-only |

### Criterios de cada adaptador

- Ejemplo en `examples/<fw>/` que: monta, inserta una variable, exporta PDF.
- Tests: mount/unmount sin fugas (destroy quita wrapper `.pde-editor-wrapper`).
- README de 1 página: peeks de código, theming (`data-pde-theme`), CSS a importar (`themes/base.css` + `components.css`).
- Ningún adaptador añade `pg`, S3 SDK ni CSS-in-JS obligatorio.

### Vanilla (cerrar el hueco)

Hoy el ejemplo oficial es `examples/vanilla/index.html` con `mountVanillaEditor`. `examples/vanilla-web.html` queda como demo de HTML estático.

---

## Fuera de este roadmap

- CRDT / comentarios / track changes (roadmap principal §2.2).
- Importación DOCX/ODT.
- OfficeMath.
- Driver PostgreSQL y HTTP API (deuda del núcleo, no de usabilidad).
- Temas extra más allá de los 4 + tokens.

## Definición de terminado (feature)

Tests del picker/comando, un flujo en playground, export no rompe, cero deps runtime, docs cortas en `docs/guide/editor.md` o `docs/playground`.

## Primera slice recomendada

1. `mountVanillaEditor` + documentar.  
2. Feature 1 (paleta + slash) sobre comandos existentes.  
3. Feature 2 (bubble).  
4. React adapter (el más pedido).  
5. Feature 3 (variables/links).
