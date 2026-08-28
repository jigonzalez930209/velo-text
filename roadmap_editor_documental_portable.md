# Roadmap técnico: editor documental portable con variables, imágenes y exportación PDF

**Versión:** 1.1  
**Fecha:** 27 de agosto de 2026  
**Objetivo:** diseñar e implementar una biblioteca autocontenida, sin dependencias de ejecución, capaz de editar documentos enriquecidos, insertar variables como `{{name}}`, manejar tablas e imágenes y exportar el mismo documento desde frontend o backend a **PDF, ODT y DOCX**. Interoperabilidad LibreOffice/Word en CI y paridad visual completa con PDF siguen abiertas (§2.4).

**Leyenda de estado** (revisión contra el repo, 27 ago 2026): `[x]` hecho · `[~]` parcial / contrato sin host real · `[ ]` pendiente.

**Siguiente documento:** [roadmap_usabilidad_y_adaptadores.md](./roadmap_usabilidad_y_adaptadores.md) — 10 features de usabilidad + adaptadores Vue, React, Svelte, Vanilla, Angular y Astro.

### Estado contra el código

| Área | Estado | Notas |
| --- | --- | --- |
| Hito A (vertical demostrable) | `[x]` | AST, editor, `{{name}}`, PNG/JPEG, JSON, **PDF**, temas |
| Hito B (MVP usable) | `[~]` | Tablas, 4 temas, S3/PG como **puertos**; HTTP de ejemplo in-memory; sin `pg` ni SDK S3 |
| Hito C (v1.0 dura) | `[~]` | Repeat rows, SVG/WebP, layout, fuzz, docs; falta OMML, fuentes PDF embebidas, goldens perceptuales, PG real |
| Fases 0–3, 5.1, 6, 7.1 (subset), 8.1, 9.1, 11, 12.1 (base) | `[x]` / `[~]` | Ver fases abajo |
| Fase 4 editor | `[~]` | `contenteditable` + `domToAst`; color/fuente/sangría/link en playground; **no** intent→op por tecla |
| Fase 5.2 / 10 | `[~]` | Contrato + in-memory + SQL + SigV4 + `examples/http-api.mjs`; no driver `pg` |
| Fase 7.1.3 fuentes PDF | `[~]` | Standard-14 Helvetica/Symbol documentado; **sin TTF embebido** (licencias) |
| `tests/property/` | `[x]` | Ops aleatorias + idempotencia |
| Colaboración CRDT, import DOCX/ODT, OfficeMath | `[ ]` | Fuera de v1 (§2.2) |

## 1. Resumen ejecutivo

El producto será un editor visual inspirado en la experiencia del Lexical Playground, pero construido sobre un modelo documental propio, estable y serializable. El Playground de Lexical muestra una arquitectura basada en árbol de nodos, estado inspeccionable y funciones agregadas mediante plugins. Lexical, además, considera su estado interno, no el DOM, como fuente de verdad y permite serializarlo como JSON. Adoptaremos esos principios, pero no su código ni sus paquetes. citeturn1view1turn1search2turn1search3

La biblioteca tendrá cinco capas claramente separadas:

1. **Core documental:** árbol canónico, operaciones, selección, historial, normalización y validación.
2. **Editor web:** `contenteditable`, toolbar, selección visual, portapapeles, drag and drop y temas.
3. **Motor de plantillas:** variables escalares, rutas, valores con formato y repetición de filas.
4. **Exportadores:** PDF, ODT y DOCX de producto (`exportDocument`); paridad visual Office vs PDF incompleta.
5. **Adaptadores:** persistencia PostgreSQL, almacenamiento compatible con S3, red y sistema de archivos.

La expresión “sin librerías externas” se definirá de forma verificable como **cero dependencias de ejecución**. Se usarán únicamente APIs estándar de JavaScript, Web APIs disponibles y módulos incluidos en la propia biblioteca. El repositorio podrá usar herramientas de desarrollo solo si se decide hacerlo, pero el artefacto distribuido no dependerá de ellas. Para cumplir de forma estricta, el plan también contempla un runner de pruebas y scripts de construcción internos.

> **Decisión clave:** el documento canónico nunca será HTML, DOCX, ODT ni PDF. Será un AST JSON versionado. HTML será solo una vista editable; PDF, ODT y DOCX son salidas derivadas. Esto evita que cada formato se convierta en una fuente de verdad diferente.

---

## 2. Alcance funcional

### 2.1 Funciones incluidas en la primera versión estable

- `[x]` Texto, párrafos, títulos, citas, separadores, listas ordenadas y no ordenadas.
- `[x]` Negrita, cursiva, subrayado, tachado, código. Color, fondo, tamaño y familia: modelo + parse/render + UI en playground (panel Insert).
- `[x]` Alineación, saltos de página y **sangría** (`indent` / outdent, `indentLevel` en el AST).
- `[x]` Tablas: filas, columnas, resize, menú, **merge right / split**.
- `[x]` Variables en texto y celdas: `{{name}}`, `{{customer.address.city}}`.
- `[x]` Variables como nodos atómicos. Popover de path / format / fallback.
- `[x]` Imágenes WebP, PNG, JPEG/JPG y SVG (sniff + sanitizar SVG).
- `[x]` Deshacer/rehacer (snapshots), atajos, pegar HTML allowlist, copiar.
- `[x]` Exportación **PDF** en navegador (`Blob`) y backend (`File`/`Buffer`) con reloj/IDs inyectables.
- `[x]` Cuatro temas: `light-neutral`, `light-warm`, `dark-slate`, `dark-contrast`.
- `[x]` Colores y radios vía tokens CSS `--pde-*`.
- `[~]` Persistencia PostgreSQL: contrato + SQL + in-memory + **HTTP de ejemplo** (`examples/http-api.mjs`). Sin driver `pg`.
- `[~]` Assets por referencia (no binarios en el AST). Store + GC en memoria.
- `[~]` URLs prefirmadas SigV4 en el adaptador; **sin bucket real en CI**.
- `[x]` Ecuaciones LaTeX sencillas (`\frac`, `\sqrt`, `^/_`, griego).
- `[x]` Iconos SVG inline con `currentColor`.
- `[x]` Extra post-v1 en el editor: columnas (presets + gutters), mosaico hasta 3 filas, inserción de tabla tipo Word 4×10.

### 2.2 Fuera del alcance inicial

- Edición colaborativa en tiempo real mediante CRDT.
- Importación perfecta de cualquier DOCX u ODT arbitrario.
- Macros, campos Word complejos, ecuaciones OfficeMath y seguimiento completo de cambios.
- Maquetación tipográfica idéntica a Microsoft Word o LibreOffice en todos los sistemas.
- Conversión fiable de SVG o WebP dentro de consumidores DOCX antiguos sin generar también un fallback PNG.
- Firmas digitales de documentos.

Estas funciones se dejan como extensiones posteriores para proteger la calidad del núcleo y evitar que el MVP se convierta en una implementación completa de tres suites ofimáticas.

### 2.3 Criterio de paridad frontend/backend

La misma entrada lógica debe generar el mismo contenido, metadatos y estructura en ambos entornos. Los bytes pueden diferir si incluyen fechas de empaquetado, identificadores aleatorios o compresión distinta. Para pruebas deterministas se inyectarán reloj, generador de IDs y política de compresión.

### 2.4 Versión 1.5 — TODO (mínimo)

Superficie de producto ODT/DOCX (playground, ejemplos, HTTP, docs) **hecha**. Sigue el trabajo de paridad e interoperabilidad Office.

- `[x]` Playground y ejemplos: botones ODT / DOCX otra vez.
- `[x]` HTTP `POST /documents/:id/export?format=odt|docx`.
- `[~]` Paridad con PDF: tablas continuas, alineación de imágenes, desescalado al incrustar, tamaños reales.
- `[ ]` Interoperabilidad LibreOffice / Word en CI (no solo validadores propios).
- `[~]` Columnas, ecuaciones e imágenes con calidad de documento en ambos formatos.
- `[x]` Documentar ODT/DOCX como formatos soportados (README, docs, matriz).

Hasta entonces el hueco principal es **abrir/guardar en LO/Word en CI** y acercar tablas/imágenes al nivel PDF.

---

## 3. Principios de arquitectura

### 3.1 Núcleo puro y puertos de plataforma

El core no podrá acceder directamente a `window`, `document`, `fs`, PostgreSQL ni S3. Recibirá capacidades por interfaces:

```ts
export interface BinarySink {
  write(chunk: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
}

export interface AssetResolver {
  resolve(assetId: string, variant?: string): Promise<ResolvedAsset>;
}

export interface Clock {
  nowIso(): string;
}

export interface IdGenerator {
  next(): string;
}
```

Esto permite usar la misma lógica de exportación con `Blob` en navegador, streams en backend o buffers en pruebas.

### 3.2 Estado canónico e inmutable

Cada transacción parte de un snapshot válido y produce otro. No se expondrán mutaciones directas a consumidores. Lexical también usa snapshots serializables y separa estructura de presentación; esta idea es útil como referencia arquitectónica, aunque el formato será completamente propio. citeturn1search2turn1search3

### 3.3 Operaciones antes que manipulación del DOM

El DOM refleja el estado. Una pulsación crea una operación, la operación modifica el AST y el reconciliador aplica el cambio mínimo al DOM. No se guardará `innerHTML` como documento.

### 3.4 Capacidades explícitas

Cada módulo declara las capacidades que necesita. Por ejemplo, el exportador DOCX solicita `AssetResolver`, `ZipWriter`, `XmlWriter` y `Clock`. Esto vuelve testeable el sistema y evita dependencias ocultas.

### 3.5 Seguridad por defecto

- No ejecutar HTML pegado.
- No interpretar variables como HTML.
- No permitir URLs peligrosas como `javascript:`.
- Rechazar imágenes que no coincidan con firma mágica, MIME y límites configurados.
- Escapar siempre XML y contenido PDF.
- Ignorar propiedades desconocidas durante renderizado, pero conservarlas solo bajo una política explícita de compatibilidad.

---

## 4. Estructura propuesta del repositorio

```text
velo-text/
├── src/
│   ├── core/
│   │   ├── model/
│   │   ├── operations/
│   │   ├── selection/
│   │   ├── history/
│   │   ├── normalize/
│   │   ├── schema/
│   │   └── events/
│   ├── template/
│   │   ├── parser/
│   │   ├── resolver/
│   │   ├── formatter/
│   │   └── diagnostics/
│   ├── editor-web/
│   │   ├── view/
│   │   ├── input/
│   │   ├── clipboard/
│   │   ├── toolbar/
│   │   ├── tables/
│   │   ├── images/
│   │   └── accessibility/
│   ├── export/
│   │   ├── layout/
│   │   ├── pdf/
│   │   ├── odt/
│   │   ├── docx/
│   │   ├── xml/
│   │   └── zip/
│   ├── assets/
│   │   ├── sniff/
│   │   ├── dimensions/
│   │   ├── svg/
│   │   └── hashing/
│   ├── adapters/
│   │   ├── browser/
│   │   ├── backend/
│   │   ├── postgres-contract/
│   │   └── s3-compatible/
│   ├── theme/
│   └── public-api/
├── themes/
├── schemas/
├── migrations/
├── tests/
│   ├── unit/
│   ├── property/
│   ├── integration/
│   ├── conformance/
│   ├── visual/
│   ├── security/
│   └── fixtures/
├── examples/
└── docs/
```

---

## 5. Modelo de datos canónico

### 5.1 Envelope del documento

```ts
interface PortableDocument {
  schema: "portable-doc";
  schemaVersion: 1;
  id: string;
  revision: number;
  locale: string;
  direction: "ltr" | "rtl" | "auto";
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, JsonValue>;
  page: PageSettings;
  root: RootNode;
  assets: Record<string, AssetRef>;
  variableSchema?: VariableSchema;
  extensions?: Record<string, JsonValue>;
}
```

Reglas:

- Fechas en UTC ISO 8601.
- Medidas internas en enteros de micrómetros o unidades tipográficas fijas, nunca `float` sin unidad.
- Colores como RGBA canónico, por ejemplo `#RRGGBBAA`.
- IDs opacos, estables y únicos dentro del documento.
- Arrays para cualquier orden significativo.
- `schemaVersion` controla migraciones, no la versión de la aplicación.

### 5.2 Árbol de nodos

```ts
type BlockNode =
  | ParagraphNode
  | HeadingNode
  | QuoteNode
  | ListNode
  | TableNode
  | ImageBlockNode
  | PageBreakNode
  | HorizontalRuleNode;

type InlineNode =
  | TextNode
  | VariableNode
  | LinkNode
  | InlineImageNode
  | HardBreakNode;

interface TextNode {
  type: "text";
  id: string;
  text: string;
  marks?: TextMarks;
}

interface VariableNode {
  type: "variable";
  id: string;
  path: string;
  source: string;
  valueType: "string" | "number" | "date" | "boolean" | "image" | "unknown";
  format?: string;
  fallback?: string;
  marks?: TextMarks;
}
```

Aunque el usuario escriba `{{name}}`, el parser lo transformará en un `VariableNode`. Su representación visual será atómica. El texto fuente se conserva para round-trip y diagnóstico.

### 5.3 Tablas

```ts
interface TableNode {
  type: "table";
  id: string;
  columns: TableColumn[];
  rows: TableRow[];
  style?: TableStyle;
  repeat?: {
    path: string;
    alias: string;
    templateRowId: string;
  };
}

interface TableCell {
  id: string;
  colSpan: number;
  rowSpan: number;
  blocks: BlockNode[];
  style?: CellStyle;
}
```

Una fila repetible podrá usar `{{item.name}}`, pero se almacenará como plantilla estructural. No se interpolará texto antes de clonar la fila.

### 5.4 Activos e imágenes

```ts
interface AssetRef {
  id: string;
  kind: "image";
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  storageKey: string;
  sha256: string;
  byteLength: number;
  widthPx?: number;
  heightPx?: number;
  alt: string;
  title?: string;
  variants?: Record<string, AssetVariant>;
}
```

El documento guarda identidad y metadatos, no URLs firmadas. Las URLs expiran y son detalles de acceso. Para SVG se exigirá sanitización y se eliminarán scripts, eventos, referencias remotas, `foreignObject` y URLs no permitidas.

### 5.5 Selección e historial

La selección es estado efímero y no se persiste con el documento principal:

```ts
interface RangeSelection {
  kind: "range";
  anchor: Point;
  focus: Point;
}

interface Point {
  nodeId: string;
  offset: number;
  affinity: "forward" | "backward";
}
```

El historial almacenará operaciones inversas agrupadas por intención, no snapshots completos para cada pulsación. Se usarán checkpoints periódicos para recuperación.

### 5.6 Validación y migración

- Validador de estructura escrito dentro de la biblioteca.
- Errores con ruta, código, severidad y recomendación.
- Migraciones secuenciales `v1 -> v2`, nunca saltos opacos.
- Fixtures de todas las versiones publicadas.
- Regla de compatibilidad: leer las dos versiones anteriores y escribir solo la actual.

---

## 6. Motor de variables y plantillas

### 6.1 Gramática mínima

```ebnf
variable   = "{{", ws, path, [ws, "|", ws, format], [ws, "??", ws, string], ws, "}}" ;
path       = identifier, { ".", identifier | "[", integer, "]" } ;
format     = identifier, [":", formatArg] ;
identifier = letter | "_", { letter | digit | "_" } ;
```

Ejemplos:

```text
{{name}}
{{customer.address.city}}
{{invoice.total | currency:ARS}}
{{createdAt | date:dd/MM/yyyy}}
{{missing ?? "Sin datos"}}
```

No se permitirá ejecutar JavaScript ni expresiones arbitrarias. Los formateadores serán funciones registradas con entrada y salida tipadas.

### 6.2 API de resolución

```ts
const result = renderTemplate(document, data, {
  mode: "strict",
  locale: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
  missing: "error"
});
```

El resultado contendrá:

- Documento materializado.
- Diagnósticos por variable.
- Variables utilizadas y no utilizadas.
- Assets resueltos.
- Hash de entrada y de salida.

### 6.3 Reglas de seguridad

- Acceso exclusivo a propiedades propias.
- Bloqueo de rutas como `__proto__`, `prototype` y `constructor`.
- Profundidad máxima de rutas.
- Longitud máxima del valor resultante.
- Formateadores con timeout cooperativo cuando el entorno lo permita.
- Valores convertidos a nodos de texto, nunca a HTML.

### 6.4 Casos en tablas

1. Variable escalar dentro de celda.
2. Variable que produce una imagen.
3. Repetición de una fila por cada elemento de una colección.
4. Condición simple declarativa para omitir una fila.
5. Encabezado repetido al cambiar de página.
6. Página vacía o colección vacía con fila fallback opcional.

---

## 7. Editor web sin dependencias

### 7.1 Renderizador

- Host `contenteditable` controlado.
- Cada nodo DOM tendrá `data-node-id` y `data-node-type`.
- Reconciliación por IDs y tipo de nodo.
- El DOM no se leerá completo después de cada cambio.
- `MutationObserver` detectará mutaciones inesperadas de extensiones o autocorrectores.
- Las variables se renderizarán con `contenteditable="false"` y navegación de teclado definida.

### 7.2 Pipeline de entrada

```text
beforeinput / keydown / paste / drop
  -> normalizar evento
  -> convertir a intención
  -> generar operación
  -> validar precondiciones
  -> aplicar transacción al AST
  -> normalizar AST
  -> reconciliar DOM
  -> restaurar selección
  -> emitir evento de cambio
```

### 7.3 Comandos

```ts
editor.execute("text.toggleBold");
editor.execute("table.insertRowAfter");
editor.execute("variable.insert", { path: "customer.name" });
editor.execute("image.insert", { assetId: "asset_123" });
editor.execute("document.export", { format: "docx" });
```

Los comandos tendrán `canExecute`, `execute`, payload validado y cambios invertibles.

### 7.4 Pegado

- `text/plain`: convertir saltos a párrafos y hard breaks según contexto.
- `text/html`: parsear con `DOMParser`, recorrer una allowlist y convertir a AST.
- Imágenes: validar bytes antes de registrar el asset.
- Tablas HTML: mapear filas/celdas, límites y spans.
- Descartar estilos desconocidos, scripts, formularios, iframes y atributos de eventos.

### 7.5 Accesibilidad

- Toolbar navegable por teclado.
- Roles ARIA correctos y etiquetas visibles.
- Estado de formato anunciado.
- Alto contraste en los cuatro temas.
- Texto alternativo obligatorio para imágenes, permitiendo vacío solo si se marca decorativa.
- Navegación de tablas y variables sin trampas de foco.
- Pruebas manuales con teclado y al menos dos lectores de pantalla antes de versión estable.

---

## 8. Imágenes y almacenamiento compatible con S3

### 8.1 Pipeline de subida

```text
selección/drag-drop
  -> límite preliminar por tamaño
  -> lectura de cabecera
  -> detección real de formato
  -> dimensiones y protección anti-bomba
  -> hash SHA-256
  -> solicitud de sesión de carga
  -> PUT a URL firmada
  -> confirmación backend
  -> creación de AssetRef
  -> inserción del nodo en el documento
```

### 8.2 Contrato de endpoints

```http
POST /v1/assets/upload-intents
Content-Type: application/json

{
  "sha256": "...",
  "byteLength": 123456,
  "mediaType": "image/png",
  "fileName": "logo.png"
}
```

```json
{
  "assetId": "ast_01...",
  "method": "PUT",
  "uploadUrl": "https://storage.example/...",
  "requiredHeaders": {
    "content-type": "image/png",
    "x-content-sha256": "..."
  },
  "expiresAt": "2026-08-27T15:00:00Z"
}
```

La URL firmada debe restringir clave, método, vencimiento, tamaño esperado cuando sea posible y checksum. AWS documenta que las URLs prefirmadas permiten cargas y descargas temporales y que los checksums pueden verificar integridad. citeturn1search14

### 8.3 Compatibilidad entre formatos

- **PNG/JPEG:** incrustación directa en los tres exportadores.
- **SVG:** ODT puede preservar el original; PDF podrá ejecutar un subset SVG seguro propio; DOCX incluirá SVG y, si existe, fallback PNG.
- **WebP:** conservar original en assets y generar variante PNG al momento de carga o exportación.
- **Restricción honesta:** una conversión universal WebP/SVG a PNG sin librerías requiere usar APIs nativas de imagen/canvas en navegador o un codec incluido en backend. El proyecto incluirá una interfaz de transcodificación y, para backend autocontenido, un decodificador del subset soportado. Si una imagen usa características no soportadas, la exportación fallará con diagnóstico explícito, nunca silenciosamente.

### 8.4 Políticas

- Dedupe por hash dentro del tenant.
- Claves no predecibles y sin nombre original.
- Cifrado y política de retención definidos en infraestructura.
- Antivirus como puerto opcional del backend.
- Borrado diferido solo cuando el asset no tenga referencias.
- Separación estricta entre asset lógico y objeto físico.

---

## 9. Persistencia PostgreSQL

### 9.1 Modelo híbrido

Usar columnas relacionales para identidad, permisos, revisiones y búsqueda operacional, y `jsonb` para el AST. `jsonb` ofrece operadores e índices; el documento debe seguir validándose en la aplicación porque la base no conoce todas las invariantes del AST. citeturn1search15turn1search16

```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  schema_version integer NOT NULL,
  current_revision bigint NOT NULL DEFAULT 0,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE TABLE document_revisions (
  document_id uuid NOT NULL REFERENCES documents(id),
  revision bigint NOT NULL,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (document_id, revision)
);

CREATE TABLE assets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  storage_key text NOT NULL,
  media_type text NOT NULL,
  sha256 bytea NOT NULL,
  byte_length bigint NOT NULL,
  width_px integer,
  height_px integer,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (tenant_id, sha256)
);

CREATE TABLE document_assets (
  document_id uuid NOT NULL REFERENCES documents(id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  PRIMARY KEY (document_id, asset_id)
);
```

### 9.2 Control de concurrencia

```sql
UPDATE documents
SET content = $1,
    content_hash = $2,
    current_revision = current_revision + 1,
    updated_at = now()
WHERE id = $3
  AND tenant_id = $4
  AND current_revision = $5
RETURNING current_revision;
```

Si no retorna filas, responder `409 Conflict` con la revisión actual. No usar “última escritura gana” por defecto.

### 9.3 Índices

- B-tree por `tenant_id`, `updated_at` y propietarios.
- Índice parcial para documentos no eliminados.
- GIN en `content` solo si existe una consulta justificada y medida.
- Tabla derivada para variables utilizadas si se requiere búsqueda frecuente.
- No indexar indiscriminadamente todo el AST.

### 9.4 Integridad

- Hash canónico del AST normalizado.
- Revisión inmutable por guardado significativo.
- Transacción que actualiza documento, revisión y referencias de assets.
- Job de reconciliación para detectar assets huérfanos.
- Restauración probada, no solo backups configurados.

---

## 10. Exportación común

### 10.1 Pipeline independiente del formato

```text
PortableDocument
  -> validar y migrar
  -> resolver variables
  -> resolver assets
  -> normalizar estilos
  -> construir modelo de layout
  -> paginar
  -> adaptar al formato
  -> empaquetar/escribir
  -> validar salida
```

El modelo de layout intermedio incluirá páginas, cajas, líneas, runs, tablas, imágenes y enlaces. DOCX y ODT permiten layout posterior por el consumidor, pero compartir el normalizador evita diferencias semánticas.

### 10.2 API pública

```ts
const result = await exportDocument({
  document,
  data,
  format: "pdf",
  assets,
  sink,
  options: {
    deterministic: true,
    strict: true,
    imagePolicy: "prefer-compatible",
    missingVariable: "error"
  }
});
```

### 10.3 Exportador PDF

Implementar un escritor PDF incluido con:

- Catálogo, árbol de páginas, streams de contenido y xref.
- Fuentes base para prototipo y fuentes incrustadas para producción.
- Subsetting tipográfico como fase posterior, empezando por incrustación completa.
- Cálculo de métricas, line breaking, bidi y fallback de fuentes.
- Imágenes PNG/JPEG directas; SVG mediante renderizador seguro soportado.
- Metadatos, enlaces, bookmarks y páginas.
- Compresión opcional si existe codec incluido o API nativa compatible.

**Riesgo principal:** tipografía compleja. El MVP debe declarar las escrituras soportadas y añadir pruebas específicas antes de prometer paridad universal.

### 10.4 Exportador ODT

ODT 1.3 es un paquete compuesto por archivos XML, manifiesto, estilos y recursos. La especificación OASIS separa explícitamente la parte de paquetes y el esquema, por lo que nuestra implementación debe validar tanto la estructura ZIP como el XML generado. citeturn1search10turn1search12

Contenido mínimo:

```text
mimetype
META-INF/manifest.xml
content.xml
styles.xml
meta.xml
settings.xml
Pictures/*
```

Reglas:

- `mimetype` será la primera entrada y sin compresión.
- Estilos deduplicados por hash.
- Variables ya materializadas, salvo modo opcional de campos propios.
- Validación contra esquema ODF disponible en CI.
- Pruebas de apertura en LibreOffice y Microsoft Word.

### 10.5 Exportador DOCX

DOCX se generará como paquete Open XML:

```text
[Content_Types].xml
_rels/.rels
word/document.xml
word/styles.xml
word/settings.xml
word/_rels/document.xml.rels
word/media/*
docProps/core.xml
docProps/app.xml
```

Reglas:

- IDs de relaciones deterministas.
- Escape XML centralizado.
- Estilos nominales y directos claramente separados.
- Tablas con grid, spans y ancho coherente.
- Saltos de página explícitos.
- Imágenes con dimensiones convertidas a EMU.
- Validación estructural y apertura real en Word/LibreOffice.

### 10.6 ZIP autocontenido

El proyecto incluirá:

- CRC-32.
- Escritura de local headers.
- Central directory.
- EOCD.
- Método STORE obligatorio.
- DEFLATE opcional mediante implementación propia incluida o capacidad nativa inyectada.
- Escritura streaming cuando el sink lo permita.

STORE permite un primer paquete válido sin depender de compresión externa, a costa de archivos mayores.

---

## 11. Temas y CSS

### 11.1 Tokens

Todos los componentes usarán variables, nunca colores literales:

```css
.pde-root {
  --pde-color-bg: #ffffff;
  --pde-color-surface: #f7f8fa;
  --pde-color-text: #17191c;
  --pde-color-muted: #667085;
  --pde-color-border: #d8dce3;
  --pde-color-primary: #3659e3;
  --pde-color-primary-contrast: #ffffff;
  --pde-color-selection: #cbd7ff;
  --pde-color-variable-bg: #e8efff;
  --pde-color-variable-text: #1939a3;
  --pde-color-danger: #b42318;
  --pde-shadow-panel: 0 8px 24px rgb(0 0 0 / 12%);
  --pde-radius-sm: 4px;
  --pde-radius-md: 8px;
  --pde-font-ui: system-ui, sans-serif;
}
```

### 11.2 Cuatro temas incluidos

1. `light-neutral`: claro, gris neutro.
2. `light-warm`: claro, tonos cálidos.
3. `dark-slate`: oscuro, gris azulado.
4. `dark-contrast`: oscuro, contraste alto.

Cada tema será una asignación de variables bajo `[data-pde-theme="..."]`. El consumidor podrá reemplazar una, varias o todas las propiedades.

### 11.3 Pruebas visuales

- Capturas deterministas de toolbar, documento, tablas, variables e imágenes.
- Estados hover, focus, disabled, error y selección.
- Contraste automatizado donde sea posible.
- Pruebas con zoom 200 %, ancho reducido y preferencias de movimiento.

---

## 12. API pública y extensibilidad

### 12.1 Superficie mínima

```ts
export {
  createEditor,
  createDocument,
  parseDocument,
  validateDocument,
  migrateDocument,
  renderTemplate,
  exportDocument,
  inspectVariables,
  registerNodeType,
  registerFormatter,
  registerCommand
};
```

### 12.2 Extensiones sin acoplamiento

Una extensión declara:

- Tipo y versión.
- Esquema del nodo.
- Normalizador.
- Renderizador web.
- Serializador.
- Adaptadores PDF, DOCX y ODT o fallback.
- Comandos.
- Migraciones.
- Pruebas de contrato.

Si una extensión no define salida para un formato, la exportación estricta falla con código conocido. En modo tolerante se inserta un placeholder accesible y se registra diagnóstico.

### 12.3 Agnosticismo real

- Sin React, Vue, Angular ni Svelte en el core.
- Custom Element opcional construido con APIs estándar.
- Backend compatible con cualquier runtime que implemente los puertos requeridos.
- Persistencia definida por contratos, no por ORM.
- S3 definido por HTTP y firma, no por SDK obligatorio.
- Formatos exportados por escritores internos.

---

## 13. Estrategia de testing

### 13.1 Pirámide de pruebas

1. **Unitarias:** parser, operaciones, normalización, XML, ZIP, CRC y layout.
2. **Basadas en propiedades:** secuencias aleatorias de edición nunca producen AST inválido.
3. **Round-trip:** serializar, leer y comparar forma canónica.
4. **Integración:** DOM, selección, portapapeles, assets y exportadores.
5. **Conformidad:** esquemas ODF/Open XML, validador PDF y apertura real.
6. **Golden files:** estructura XML y páginas renderizadas.
7. **End-to-end:** plantilla, datos, assets, exportación, descarga y reapertura.
8. **Seguridad:** corpus malicioso, fuzzing y límites de recursos.
9. **Rendimiento:** documentos grandes con presupuestos versionados.

### 13.2 Matriz mínima

- Navegadores: Chromium, Firefox, WebKit.
- Backend: runtime principal y uno alternativo.
- Consumidores: Word, LibreOffice y visor PDF principal de cada plataforma objetivo.
- Documentos: vacío, texto extenso, 100 páginas, tabla de 10.000 celdas, 100 imágenes, Unicode mixto y RTL.

### 13.3 Invariantes

- Root válido y único.
- IDs únicos.
- Ningún texto directamente bajo root.
- Spans de tabla sin solapamiento.
- Assets referenciados existentes.
- Variables con rutas válidas.
- Ninguna operación pierde contenido fuera de su rango.
- `undo(redo(x))` conserva el documento canónico.
- Exportación nunca modifica el documento fuente.

### 13.4 Presupuestos iniciales

- Escritura visible: menos de 16 ms por operación típica en documento de 50 páginas.
- Pegado de 1 MB: menos de 1 s en equipo de referencia.
- Guardado incremental: no bloquear UI más de 50 ms.
- Exportación de 100 páginas: progreso observable y cancelación.
- Memoria: sin crecimiento después de ciclos repetidos de abrir/cerrar.

Los números deberán recalibrarse con hardware de referencia y datos reales, pero no eliminarse.

---

## 14. Roadmap de implementación con depth 3

## Fase 0. Definición ejecutable del producto — **`[x]` hecho**

### 0.1 Cerrar el contrato de alcance

#### 0.1.1 Especificar el subset documental
- Enumerar todos los nodos, marcas y atributos de v1.
- Definir comportamientos de teclado y toolbar.
- Crear ejemplos aceptados y rechazados.
- Publicar una matriz nodo por formato: Web, PDF, ODT y DOCX.

#### 0.1.2 Definir “sin dependencias”
- Cero dependencias runtime en el manifiesto distribuido.
- Inventario de APIs nativas utilizadas.
- Política para código copiado o generado.
- Auditoría de licencias y procedencia.

#### 0.1.3 Establecer criterios de salida
- Documento de aceptación por feature.
- Presupuestos de rendimiento.
- Plataformas soportadas.
- Política de compatibilidad y versionado.

**Pruebas de fase:** revisión de arquitectura, matriz de trazabilidad y prueba de un spike que cree ZIP, PDF mínimo y DOM editable sin paquetes externos.

## Fase 1. Infraestructura y harness de pruebas — **`[x]` hecho**

### 1.1 Construcción reproducible

#### 1.1.1 Configurar módulos
- Separar core, web, template, assets y exportadores.
- Evitar imports circulares.
- Crear entrypoints explícitos.
- Probar tree shaking conceptual aunque el bundle sea propio.

#### 1.1.2 Runner interno
- `test(name, fn)`, assertions, suites, hooks y reporte TAP/JSON.
- Soporte async, timeout y seeds.
- Salida no cero ante fallo.
- Fixtures binarias versionadas.

#### 1.1.3 CI
- Lint interno o reglas del compilador.
- Tests por capa.
- Artifacts de fallos visuales.
- Comprobación de cero dependencias.

**Pruebas de fase:** un test deliberadamente fallido debe bloquear CI; builds repetidos con reloj fijo deben producir hashes idénticos.

## Fase 2. AST, esquema y operaciones — **`[x]` hecho** (`tests/property` + fuzz)

### 2.1 Implementar nodos

#### 2.1.1 Tipos base
- Root, paragraph, text, heading, list, table, image y variable.
- Factories con defaults canónicos.
- IDs inyectables.
- Serialización estable.

#### 2.1.2 Validador
- Tipos, rangos, IDs, referencias y profundidad.
- Diagnósticos con JSON Pointer.
- Límite de errores.
- Modo estricto y tolerante.

#### 2.1.3 Normalizador
- Fusionar textos adyacentes con mismas marcas.
- Eliminar nodos vacíos ilegales.
- Reparar estructura de listas/tablas dentro de límites.
- Garantizar idempotencia.

### 2.2 Motor transaccional

#### 2.2.1 Operaciones primitivas
- Insertar, borrar, dividir, unir, mover y aplicar marcas.
- Precondiciones y operación inversa.
- Agrupación por intención.
- Eventos antes/después.

#### 2.2.2 Selección
- Mapeo a través de operaciones.
- Afinidad en límites.
- Selección de nodos atómicos.
- Rangos sobre múltiples bloques.

#### 2.2.3 Historial
- Undo/redo.
- Coalescing por tiempo e intención.
- Checkpoints.
- Límite de memoria.

**Pruebas de fase:** property testing con miles de operaciones aleatorias; normalización idempotente; undo completo vuelve al hash inicial.

## Fase 3. Motor de variables — **`[x]` hecho** (falta popover de edición 3.1.3)

### 3.1 Lexer y parser

#### 3.1.1 Tokenización incremental
- Detectar `{{` y `}}` durante escritura/pegado.
- No bloquear llaves como texto normal.
- Manejar variables entre varios text nodes.
- Diagnóstico de expresiones incompletas.

#### 3.1.2 AST de expresión
- Ruta, formato, fallback y tipo esperado.
- Sin evaluación dinámica.
- Posición fuente para mensajes.
- Serialización canónica.

#### 3.1.3 VariableNode atómico
- Inserción desde catálogo.
- Edición mediante popover.
- Borrado con una acción predecible.
- Copia entre documentos.

### 3.2 Resolución

#### 3.2.1 Resolver seguro
- Lectura de propiedades propias.
- Bloqueo de prototipos.
- Valores nulos y ausentes diferenciados.
- Límites de profundidad y tamaño.

#### 3.2.2 Formateadores
- Texto, número, moneda, porcentaje, fecha y booleano.
- Locale y timezone explícitos.
- Registro de extensiones.
- Fallback determinista.

#### 3.2.3 Tablas repetibles
- Clonado de filas con IDs nuevos.
- Alias local.
- Colección vacía.
- Límite máximo de filas.

**Pruebas de fase:** corpus de expresiones válidas/inválidas, inyección de prototipo, locales y zonas horarias, variables dentro de cada posición de una tabla.

## Fase 4. Editor web — **`[~]` parcial** (DOM es superficie de tipeo; no hay ops por cada tecla; IME/móvil no matriz)

### 4.1 Render y reconciliación

#### 4.1.1 Mapeo AST-DOM
- Render por tipo.
- Índice bidireccional nodeId/element.
- Parches mínimos.
- Recuperación ante mutación externa.

#### 4.1.2 Selección
- DOM Selection a selección lógica y viceversa.
- Casos de nodos atómicos.
- IME y composición.
- Dirección de selección.

#### 4.1.3 Entrada
- `beforeinput` como camino principal.
- Fallbacks documentados.
- Atajos configurables.
- Mobile y autocorrección.

### 4.2 Funciones de edición

#### 4.2.1 Texto y bloques
- Formatos, headings, listas, citas y enlaces.
- Separación/unión de párrafos.
- Indentación.
- Clear formatting.

#### 4.2.2 Tablas
- Insertar/eliminar filas y columnas.
- spans.
- Navegación Tab/Shift+Tab.
- Selección de celdas.

#### 4.2.3 Clipboard y DnD
- Texto, HTML y fragmento interno.
- Sanitización allowlist.
- Imágenes.
- Límites de pegado.

**Pruebas de fase:** suites por evento, IME, teclado completo, snapshots DOM, paste malicioso y E2E de edición de tabla.

## Fase 5. Assets e imágenes — **`[~]` parcial** (5.1 `[x]`; 5.2 contrato + fake, sin S3 de integración)

### 5.1 Validación binaria

#### 5.1.1 Sniffing
- Firmas PNG, JPEG, WebP y estructura SVG.
- MIME declarado versus real.
- Límites de bytes y dimensiones.
- Casos truncados.

#### 5.1.2 Metadatos
- Dimensiones sin decodificar toda la imagen cuando sea posible.
- Orientación JPEG.
- Hash SHA-256.
- Alt text y estado decorativo.

#### 5.1.3 Sanitización SVG
- Parser XML interno seguro.
- Allowlist de elementos/atributos.
- Sin red, scripts ni eventos.
- Canonicalización.

### 5.2 Almacenamiento remoto

#### 5.2.1 AssetStore
- Interfaz create/put/confirm/get/delete.
- Adaptador browser y backend.
- Reintentos idempotentes.
- Cancelación.

#### 5.2.2 S3 compatible
- Firma implementada en el adaptador incluido.
- Upload directo con URL temporal.
- Verificación de checksum.
- Confirmación server-side.

#### 5.2.3 Ciclo de vida
- Referencias transaccionales.
- Dedupe.
- Garbage collection diferida.
- Auditoría.

**Pruebas de fase:** bytes falsificados, SVG hostil, URL expirada, reintento de PUT, dedupe y eliminación concurrente.

## Fase 6. Layout compartido — **`[x]` hecho** (flotantes fuera de v1, como se planeó)

### 6.1 Medición

#### 6.1.1 Unidades
- Conversión px, pt, twip, EMU y unidades internas.
- Aritmética entera cuando sea viable.
- Rounding especificado.
- Tests de bordes.

#### 6.1.2 Texto
- Métricas de fuentes.
- Saltos de línea.
- Espacios, tabs y hard breaks.
- Fallback y caracteres faltantes.

#### 6.1.3 Bloques y tablas
- Márgenes colapsados según reglas propias.
- Keep-with-next.
- División de filas.
- Encabezados repetidos.

### 6.2 Paginación

#### 6.2.1 Algoritmo
- Flujo vertical.
- Saltos forzados.
- Viudas/huérfanas básicas.
- Imágenes flotantes fuera de v1 o claramente limitadas.

#### 6.2.2 Diagnósticos
- Contenido desbordado.
- Celdas imposibles de dividir.
- Imágenes demasiado grandes.
- Fuentes faltantes.

#### 6.2.3 Determinismo
- Reloj, IDs y orden estables.
- No depender del DOM para backend.
- Fixtures de layout.
- Hash por página.

**Pruebas de fase:** golden layout, documentos grandes, tablas en límites de página y Unicode.

## Fase 7. Exportador PDF — **`[~]` parcial** (subset usable; 7.1.3 Standard-14 `[x]`, TTF embebido `[ ]`; goldens perceptuales `[ ]`)

### 7.1 Escritor binario

#### 7.1.1 Objetos y xref
- Numeración determinista.
- Streams y longitudes.
- Trailer.
- Validación de offsets.

#### 7.1.2 Contenido
- Texto, paths, imágenes, enlaces y clipping.
- Escape y encoding.
- Estado gráfico balanceado.
- Multipágina.

#### 7.1.3 Fuentes
- Registro e incrustación.
- cmap y widths.
- Unicode mapping.
- Política de licencia de fuentes.

### 7.2 Calidad

#### 7.2.1 Metadata y accesibilidad mínima
- Título, autor, idioma y fechas.
- Orden de lectura.
- Texto alternativo cuando el nivel PDF elegido lo soporte.
- Diagnósticos de limitaciones.

#### 7.2.2 Imágenes
- PNG/JPEG.
- SVG subset.
- WebP mediante variante.
- Alpha y perfiles de color documentados.

#### 7.2.3 Validación
- Parser independiente de prueba.
- Render a imagen en CI cuando esté disponible.
- Comparación perceptual.
- Apertura en varios visores.

**Pruebas de fase:** xref corrupto detectado, fuentes Unicode, 100 páginas, transparencia e hipervínculos.

## Fase 8. Exportador ODT — producto `[x]` (paridad vs PDF `[~]`)

### 8.1 XML ODF

#### 8.1.1 Namespaces y estilos
- Registro central.
- Nombres estables.
- Dedupe.
- Escape.

#### 8.1.2 Documento
- Párrafos, listas, tablas, enlaces e imágenes.
- Page styles.
- Metadatos.
- Variables materializadas.

#### 8.1.3 Package
- `mimetype` primero y STORE.
- Manifest completo.
- Pictures.
- ZIP central directory.

### 8.2 Conformidad

#### 8.2.1 Schema
- Validación XML.
- Validación de manifest.
- Content types correctos.
- Sin relaciones huérfanas.

#### 8.2.2 Interoperabilidad
- Abrir/guardar en LibreOffice.
- Abrir en Word.
- Comparar contenido reimportado.
- Matriz de diferencias conocidas.

#### 8.2.3 Regresión
- Golden XML normalizado.
- Hash de assets.
- Fechas fijas.
- Paquetes grandes.

**Pruebas de fase:** schema ODF, apertura real, tablas con spans, SVG y estilos de página.

## Fase 9. Exportador DOCX — producto `[x]` (paridad vs PDF `[~]`)

### 9.1 Open XML

#### 9.1.1 Relaciones y content types
- IDs estables.
- Targets seguros.
- Tipos para todas las imágenes.
- Sin relaciones rotas.

#### 9.1.2 WordprocessingML
- Runs, párrafos, listas, tablas y page breaks.
- Estilos.
- Propiedades de sección.
- Metadatos.

#### 9.1.3 DrawingML
- Imágenes inline.
- Alt text.
- EMU.
- Fallbacks SVG/WebP.

### 9.2 Interoperabilidad

#### 9.2.1 Validadores
- XML well-formed.
- Reglas de referencias.
- Conteo y unicidad de IDs.
- Paquete ZIP válido.

#### 9.2.2 Aplicaciones
- Word desktop.
- Word web cuando corresponda.
- LibreOffice.
- Diferencias documentadas.

#### 9.2.3 Reparación cero
- Cualquier advertencia “Word encontró contenido ilegible” bloquea release.
- Guardar de nuevo y comparar semántica.
- Inspeccionar archivos reparados.
- Agregar fixture de regresión.

**Pruebas de fase:** tablas complejas, imágenes, listas anidadas, Unicode, headers básicos si son incluidos.

## Fase 10. PostgreSQL y API backend — **`[~]` contrato** (10.1 in-memory + SQL; 10.2 ejemplo HTTP in-memory; driver `pg` `[ ]`)

### 10.1 Repositorio documental

#### 10.1.1 Contrato
- Create, get, update, list revisions y restore.
- Concurrencia optimista.
- Idempotency keys.
- Errores normalizados.

#### 10.1.2 Transacciones
- Documento y revisión atómicos.
- Cambios de referencias de assets.
- Auditoría.
- Rollback probado.

#### 10.1.3 Consultas
- Paginación keyset.
- Filtros por tenant.
- Índices medidos.
- Explain plans versionados para consultas críticas.

### 10.2 Endpoints

#### 10.2.1 Documentos
- CRUD.
- If-Match/revisión.
- Validación de payload.
- Límites.

#### 10.2.2 Exportación
- Síncrona para documentos pequeños.
- Job para grandes.
- Progreso y cancelación.
- Artefactos temporales con vencimiento.

#### 10.2.3 Assets
- Intent, upload, confirm y download.
- URLs temporales.
- Autorización por tenant.
- Rate limits.

**Pruebas de fase:** integración con PostgreSQL real, carreras de actualización, rollback, recuperación de revisión y aislamiento tenant.

## Fase 11. Temas, API y empaquetado — **`[x]` hecho** (Shadow DOM opcional no; tarball publish no verificado aquí)

### 11.1 Theming

#### 11.1.1 Tokens
- Inventario de colores, tipografía, spacing y estados.
- Ningún literal fuera de archivos de tema.
- Defaults seguros.
- API de override.

#### 11.1.2 Cuatro temas
- Dos claros y dos oscuros.
- Contraste.
- Focus visible.
- Capturas.

#### 11.1.3 Scope CSS
- Prefijo `.pde-`.
- Variables en root del componente.
- Sin reset global.
- Compatibilidad Shadow DOM opcional.

### 11.2 Distribución

#### 11.2.1 Artefactos
- ESM principal.
- Types.
- CSS base y temas.
- Build single-file opcional.

#### 11.2.2 Contratos
- API report.
- Semver.
- Deprecaciones.
- Changelog.

#### 11.2.3 Ejemplos
- Vanilla web.
- Backend.
- PostgreSQL contract.
- S3 compatible.

**Pruebas de fase:** instalar desde tarball vacío, verificar cero dependencias, ejecutar ejemplos y comprobar overrides CSS.

## Fase 12. Endurecimiento y release — **`[~]` parcial** (fuzz, threat-model, budgets, checklist; autosave playground `[x]`; jobs/pentest `[ ]`)

### 12.1 Seguridad

#### 12.1.1 Fuzzing
- JSON, variables, XML, ZIP, imágenes y eventos DOM.
- Seeds reproducibles.
- Corpus de regresión.
- Límites de CPU/memoria.

#### 12.1.2 Threat modeling
- XSS.
- XXE.
- Zip bombs.
- SSRF mediante assets.
- Prototype pollution.
- Traversal en nombres de entradas.

#### 12.1.3 Auditoría
- Dependencias cero verificadas.
- Secretos.
- Logging sin datos sensibles.
- Permisos mínimos.

### 12.2 Rendimiento y fiabilidad

#### 12.2.1 Benchmarks
- Escritura, pegado, tabla, serialización y exportación.
- Baselines versionados.
- Umbral de regresión.
- Memoria.

#### 12.2.2 Recuperación
- Autosave.
- Revisión conflictiva.
- Asset incompleto.
- Job de exportación reiniciado.

#### 12.2.3 Release candidate
- Matriz completa.
- Migración desde fixtures antiguas.
- Interoperabilidad real.
- Documentación cerrada.

**Pruebas de fase:** pentest interno, fuzzing prolongado, soak test, restore de backup y checklist de release firmado.

---

## 15. Metodología de trabajo sencilla y robusta

### 15.1 Ciclo vertical corto

Para cada función:

1. Escribir criterio de aceptación y casos límite.
2. Crear el test que falla.
3. Implementar la unidad mínima.
4. Normalizar y revisar invariantes.
5. Agregar test de integración.
6. Agregar test de exportación cuando aplique.
7. Medir rendimiento.
8. Documentar decisión y limitación.
9. Integrar detrás de feature flag.
10. Activar por defecto cuando pase la matriz.

### 15.2 Definición de terminado

Una tarea está terminada solo si:

- Tiene tests unitarios y de integración relevantes.
- No rompe round-trip.
- Está disponible en los formatos prometidos o da error explícito.
- Tiene manejo de errores y límites.
- Tiene documentación pública.
- Mantiene cero dependencias runtime.
- Pasa seguridad, accesibilidad y rendimiento aplicables.
- Incluye migración si cambia el schema.

### 15.3 Ramas y entregas

- Trunk-based con ramas pequeñas.
- Commits enfocados.
- Feature flags para trabajo incompleto.
- Release semanal interna.
- Release pública por criterios, no por fecha fija.
- ADR corto para cada decisión irreversible.

---

## 16. Pseudocódigo de flujos críticos

### 16.1 Inserción de variable

```text
function insertVariable(path, format, fallback):
    assert selection exists
    parsed = parseVariable(buildSource(path, format, fallback))
    if parsed has errors:
        return diagnostics

    transaction = editor.beginTransaction("insert-variable")
    transaction.deleteSelectionIfNotCollapsed()
    node = VariableNode(parsed, idGenerator.next())
    transaction.insertInlineAtSelection(node)
    transaction.moveSelectionAfter(node)
    transaction.normalizeAffectedAncestors()
    transaction.commit()
```

### 16.2 Materialización

```text
function materialize(document, data, options):
    copy = structuralClone(document)
    diagnostics = []

    walk(copy.root):
        if node is VariableNode:
            value = safeResolve(data, node.path)
            if value is missing:
                handleMissing(node, options, diagnostics)
            else:
                replacement = formatToNodes(value, node)
                replace node with replacement

        if node is repeated TableNode:
            rows = safeResolve(data, node.repeat.path)
            replace template row with cloned resolved rows

    validate(copy)
    return { document: copy, diagnostics }
```

### 16.3 Guardado optimista

```text
function save(documentId, expectedRevision, document):
    validated = validateAndNormalize(document)
    canonicalBytes = canonicalJson(validated)
    hash = sha256(canonicalBytes)

    begin transaction
        updated = update documents
                  where id = documentId
                    and revision = expectedRevision
        if updated count is zero:
            rollback
            return Conflict(currentRevision)

        insert immutable revision
        replace document_asset references
    commit
    return Saved(newRevision, hash)
```

### 16.4 Exportación

```text
function exportDocument(request):
    source = migrateAndValidate(request.document)
    rendered = materialize(source, request.data, request.options)
    if strict and rendered has errors:
        fail

    assets = resolveReferencedAssets(rendered.document)
    layout = buildLayout(rendered.document, assets, request.options)

    switch request.format:
        pdf  -> PdfWriter.write(layout, request.sink)
        odt  -> OdtWriter.write(rendered.document, assets, request.sink)
        docx -> DocxWriter.write(rendered.document, assets, request.sink)

    close sink
    return diagnostics and manifest
```

---

## 17. Riesgos y mitigaciones

### 17.1 Implementar formatos sin dependencias

**Riesgo:** elevado esfuerzo y errores de interoperabilidad.  
**Mitigación:** soportar un subset explícito, usar fixtures de conformidad, validadores en CI y aplicaciones reales. Empezar por paquetes ZIP STORE y XML mínimo antes de optimizar.

### 17.2 Tipografía PDF

**Riesgo:** scripts complejos, shaping, bidi y sustitución de fuentes.  
**Mitigación:** definir matriz de escrituras, incluir un motor de métricas y shaping por etapas, y fallar si falta capacidad crítica.

### 17.3 SVG/WebP en DOCX

**Riesgo:** consumidores con soporte desigual.  
**Mitigación:** preservar original y generar fallback PNG. Mantener variantes ligadas al mismo asset lógico.

### 17.4 `contenteditable`

**Riesgo:** diferencias entre navegadores, IME y autocorrectores.  
**Mitigación:** AST como fuente de verdad, pipeline de eventos, reconciliación defensiva y matriz de navegador.

### 17.5 Scope excesivo

**Riesgo:** intentar igualar Word/Lexical completo antes de tener una vertical usable.  
**Mitigación:** slices verticales. La primera demo debe editar texto, insertar una variable e imagen, guardar JSON y exportar un documento simple a los tres formatos.

---

## 18. Hitos recomendados

### Hito A: vertical demostrable — **`[x]`**

- `[x]` AST v1.
- `[x]` Editor de párrafos y texto.
- `[x]` `{{name}}` como nodo.
- `[x]` PNG/JPEG.
- `[x]` Guardado JSON (`getDocument` / stringify).
- `[x]` PDF.
- `[x]` ODT y DOCX de producto (`exportDocument`, playground, HTTP) — paridad Office `[~]` (§2.4).
- `[x]` Un tema claro y uno oscuro (de hecho cuatro).

### Hito B: MVP usable — **`[~]`**

- `[x]` Tablas y variables en celdas.
- `[x]` Cuatro temas.
- `[~]` S3 compatible (firma + fake adapter).
- `[~]` PostgreSQL con revisiones (SQL + in-memory; sin Postgres real).
- `[x]` Exportadores con imágenes.
- `[x]` Seguridad y accesibilidad base (paste, contrast helper, toolbar).

### Hito C: versión 1.0 — **`[~]`**

- `[x]` Repetición de filas.
- `[~]` SVG/WebP; fallback PNG en DOCX antiguo no automático.
- `[x]` Layout (paginación, widows/orphans, diagnósticos).
- `[~]` Conformidad (99 fixtures × 3 formatos); interoperabilidad Word/LO manual.
- `[x]` Benchmarks y fuzzing (scripts).
- `[x]` Documentación y ejemplos (vanilla, backend, postgres, s3).

---

## 19. Primera secuencia de implementación recomendada

1. `[x]` Crear schema v1 y 30 fixtures (hay 33).
2. `[x]` Implementar validador y canonical JSON.
3. `[x]` Implementar operaciones primitivas e historial.
4. `[x]` Construir editor web de párrafos.
5. `[x]` Añadir `VariableNode` y catálogo de variables (chips + popover path/format/fallback).
6. `[x]` Añadir imágenes PNG/JPEG con AssetRef local.
7. `[x]` Implementar XmlWriter, CRC32 y ZipWriter STORE.
8. `[x]` Exportar ODT mínimo.
9. `[x]` Exportar DOCX mínimo.
10. `[x]` Implementar PDF mínimo y luego layout compartido.
11. `[x]` Añadir tablas de extremo a extremo (más columnas/mosaico).
12. `[~]` Añadir persistencia PostgreSQL y assets S3 (puertos, no hosts).
13. `[x]` SVG/WebP en paquete; **fallback PNG en DOCX** para consumidores antiguos (placeholder raster).
14. `[~]` Endurecer seguridad, accesibilidad y rendimiento (base hecha; soak/pentest `[ ]`).
15. `[ ]` Congelar API solo después de probar dos integraciones reales (apps host).

---

## 20. Decisiones finales

- **Modelo canónico:** AST JSON propio, no HTML.
- **Persistencia:** JSONB más columnas relacionales y revisiones inmutables.
- **Assets:** referencias estables, objetos en S3 compatible y URLs temporales.
- **Variables:** nodos tipados, no sustitución ciega de strings.
- **Frontend/backend:** core compartido con puertos de plataforma.
- **Dependencias:** cero runtime, escritores XML/ZIP/PDF incluidos.
- **Temas:** cuatro presets y CSS completamente tokenizado.
- **Calidad:** desarrollo guiado por pruebas, conformidad, interoperabilidad y benchmarks.
- **Estrategia:** verticales pequeñas que atraviesen edición, persistencia y los tres exportadores.

El enfoque reduce el acoplamiento y permite ampliar el editor sin hipotecar la persistencia. La parte más costosa no será el toolbar, sino la combinación de selección web, maquetación, fuentes y conformidad DOCX/ODT/PDF. Por eso esas capacidades deben validarse desde el primer hito, no dejarse para el final.

**Hecho en esta pasada (editor/export/tests):** color/fuente/sangría UI, popover de variables, merge de celdas, fallback PNG DOCX, `tests/property`, HTTP in-memory (`examples/http-api.mjs`), autosave playground, política PDF Standard-14 (`src/export/pdf/fonts.ts`).

**Sigue fuera o host-only (cero deps / §2.2):** driver PostgreSQL real / Testcontainers; S3 de integración; TTF embebido; goldens perceptuales; Word/LibreOffice en CI; intent→operation por tecla; pentest; congelar API tras dos apps reales; CRDT / import DOCX / OfficeMath. Soak corto: `scripts/soak.js`. Usabilidad y wrappers: [roadmap_usabilidad_y_adaptadores.md](./roadmap_usabilidad_y_adaptadores.md).

---

## 21. Fuentes consultadas

- Lexical Playground, referencia visual y funcional del editor: https://playground.lexical.dev/ citeturn1view1
- Lexical, concepto de Editor State serializable y separado del DOM: https://lexical.dev/docs/concepts/editor-state citeturn1search2
- Lexical, modelo de nodos: https://lexical.dev/docs/concepts/nodes citeturn1search3
- PostgreSQL, tipos JSON/JSONB: https://www.postgresql.org/docs/current/datatype-json.html citeturn1search15
- PostgreSQL, funciones y operadores JSON: https://www.postgresql.org/docs/current/functions-json.html citeturn1search16
- AWS S3, URLs prefirmadas: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html citeturn1search14
- OASIS, OpenDocument 1.3 Part 2, Packages: https://docs.oasis-open.org/office/OpenDocument/v1.3/os/part2-packages/OpenDocument-v1.3-os-part2-packages.html citeturn1search12
- Microsoft, información de implementación de ODF 1.3 en Office: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oodf13/cef24f17-3e5e-4a13-9e16-aa1ebff5e1dc citeturn1search8
