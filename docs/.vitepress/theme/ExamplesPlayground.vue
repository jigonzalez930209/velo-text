<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { createDocument, createIdGenerator, createParagraph, createText, createVariable, mountVanillaEditor, previewPdf } from "velo-text";
import type { Editor } from "velo-text";
import reactAdapter from "../../../examples/react/PortableEditor.jsx?raw";
import reactApp from "../../../examples/react/App.jsx?raw";
import vueAdapter from "../../../examples/vue/PortableEditor.vue?raw";
import vueApp from "../../../examples/vue/App.vue?raw";
import svelteAdapter from "../../../examples/svelte/portableEditor.js?raw";
import svelteApp from "../../../examples/svelte/App.svelte?raw";
import angularAdapter from "../../../examples/angular/portable-editor.ts?raw";
import angularApp from "../../../examples/angular/app.component.ts?raw";
import astroAdapter from "../../../examples/astro/PortableEditor.astro?raw";
import astroApp from "../../../examples/astro/index.astro?raw";
import vanillaHtml from "../../../examples/vanilla/index.html?raw";
import expressSrc from "../../../examples/backend/express.ts?raw";
import vercelSrc from "../../../examples/backend/vercel-api.ts?raw";
import viteSrc from "../../../examples/backend/vite.config.ts?raw";
import clientSrc from "../../../examples/backend/client-fill.js?raw";

const fwTabs = ["vanilla", "react", "vue", "svelte", "angular", "astro"] as const;
const beTabs = ["client", "vite", "express", "vercel"] as const;
const fw = ref<(typeof fwTabs)[number]>("vanilla");
const be = ref<(typeof beTabs)[number]>("client");
const nameTag = "{{name}}";
const host = ref<HTMLElement | null>(null);
const status = ref("ready");
let editor: Editor | null = null;

const fwCode = () => {
  if (fw.value === "vanilla") return vanillaHtml;
  if (fw.value === "react") return `${reactAdapter}\n\n// App.jsx\n${reactApp}`;
  if (fw.value === "vue") return `${vueAdapter}\n\n<!-- App.vue -->\n${vueApp}`;
  if (fw.value === "svelte") return `${svelteAdapter}\n\n<!-- App.svelte -->\n${svelteApp}`;
  if (fw.value === "angular") return `${angularAdapter}\n\n// app.component.ts\n${angularApp}`;
  return `${astroAdapter}\n\n--- index.astro ---\n${astroApp}`;
};

const beCode = () => {
  if (be.value === "client") return clientSrc;
  if (be.value === "vite") return viteSrc;
  if (be.value === "express") return expressSrc;
  return vercelSrc;
};

function sampleDoc() {
  const g = createIdGenerator("ex");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
  doc.root.children = [
    createParagraph(g, [
      createText(g, "Invoice for "),
      createVariable(g, "name", "{{name}}", { valueType: "string" }),
      createText(g, " — total "),
      createVariable(g, "total", "{{total}}", { valueType: "number" }),
      createText(g, "."),
    ]),
  ];
  return doc;
}

onMounted(() => {
  if (!host.value) return;
  editor = mountVanillaEditor(host.value, { document: sampleDoc(), theme: "light-neutral" });
});
onBeforeUnmount(() => editor?.destroy());

async function doPdf() {
  if (!editor) return;
  const pdf = await previewPdf({
    document: editor.getDocument(),
    data: { name: "Ada Lovelace", total: 1280 },
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([pdf.bytes as unknown as BlobPart], { type: "application/pdf" }));
  a.download = "velo-text-example.pdf";
  a.click();
  status.value = "PDF with tags filled";
}
</script>

<template>
  <div class="ex-pg" data-pde-theme="light-neutral">
    <p class="ex-lead">
      Every host wraps <code>mountVanillaEditor</code> from <strong>velo-text</strong>.
      The live editor below is that runtime. Switch tabs to see the adapter for each framework.
    </p>
    <div class="ex-tabs" role="tablist">
      <button v-for="t in fwTabs" :key="t" type="button" role="tab" :aria-selected="fw === t" :class="{ on: fw === t }" @click="fw = t">{{ t }}</button>
    </div>
    <div class="ex-grid">
      <div>
        <div class="ex-toolbar">
          <button type="button" @click="editor?.commands.insertVariable('name')">Insert {{ nameTag }}</button>
          <button type="button" @click="doPdf">Export PDF (fill tags)</button>
          <span class="ex-status">{{ status }}</span>
        </div>
        <div ref="host" class="pde-editor ex-host" />
      </div>
      <pre class="ex-code"><code>{{ fwCode() }}</code></pre>
    </div>
    <h2>Backend: fill tags → PDF</h2>
    <p class="ex-lead">
      The frontend sends <code>editor.getDocument()</code> plus a <code>data</code> object whose keys match the tags.
      Vite, Express, and Vercel share the same JSON body and <code>expressPdfHandler</code> / <code>vitePdfPlugin</code> / <code>vercelPdfHandler</code>.
    </p>
    <div class="ex-tabs" role="tablist">
      <button v-for="t in beTabs" :key="t" type="button" role="tab" :aria-selected="be === t" :class="{ on: be === t }" @click="be = t">{{ t }}</button>
    </div>
    <pre class="ex-code ex-code-wide"><code>{{ beCode() }}</code></pre>
  </div>
</template>
