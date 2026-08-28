<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import "../playground/playground.css";

const root = ref<HTMLElement | null>(null);
let destroy: (() => void) | undefined;

onMounted(async () => {
  const { mountPlayground } = await import("../playground/mount.ts");
  if (root.value) destroy = mountPlayground(root.value);
});
onBeforeUnmount(() => destroy?.());
</script>

<template>
  <div ref="root" class="pg-root" data-pde-theme="light-neutral">
    <header class="pg-header">
      <div class="pg-brand">Playground</div>
      <div class="pg-header-actions">
        <label class="pg-theme">
          <span>Theme</span>
          <select id="theme" aria-label="Theme">
            <option value="light-neutral">Light neutral</option>
            <option value="light-warm">Light warm</option>
            <option value="dark-slate">Dark slate</option>
            <option value="dark-contrast">Dark contrast</option>
          </select>
        </label>
        <button type="button" id="btn-export-pdf">PDF</button>
        <button type="button" id="btn-reset">Reset sample</button>
        <span id="save-label" class="pg-status">Saved</span>
        <span id="status" class="pg-status">ready</span>
      </div>
    </header>
    <div class="pg-layout">
      <div class="pg-editor-col">
        <div id="toolbar" class="pde-toolbar" role="toolbar" aria-label="Formatting"></div>
        <div class="pg-paper">
          <div id="editor" class="pde-editor" contenteditable="true" role="textbox" aria-label="Document editor"></div>
        </div>
        <div id="preview-wrap" class="pg-preview-wrap">
          <div id="preview" class="pde-editor pg-preview"></div>
          <p id="unresolved" class="pg-status"></p>
        </div>
      </div>
      <aside class="pg-side">
        <section class="pg-panel">
          <h3>Frameworks</h3>
          <div class="pg-frameworks">
            <a href="/examples/">Overview</a>
            <a href="/examples/vanilla">Vanilla</a>
            <a href="/examples/react">React</a>
            <a href="/examples/vue">Vue</a>
            <a href="/examples/svelte">Svelte</a>
            <a href="/examples/angular">Angular</a>
            <a href="/examples/astro">Astro</a>
          </div>
        </section>
        <section class="pg-panel">
          <h3>Variables</h3>
          <div class="var-chips" id="var-chips"></div>
        </section>
        <section class="pg-panel">
          <h3>Insert</h3>
          <div class="quick">
            <button type="button" id="btn-eq">Equation</button>
            <button type="button" id="btn-table">Table</button>
            <button type="button" id="btn-columns">Columns</button>
            <button type="button" id="btn-image">Image…</button>
            <button type="button" id="btn-indent">Indent</button>
            <button type="button" id="btn-outdent">Outdent</button>
            <button type="button" id="btn-link">Link</button>
          </div>
        </section>
        <section class="pg-panel">
          <h3>Outline</h3>
          <div id="outline" class="pg-outline"></div>
        </section>
        <section class="pg-panel">
          <h3>Revisions</h3>
          <div id="rev-list" class="pg-outline"></div>
        </section>
        <section class="pg-panel">
          <h3>Template data</h3>
          <textarea id="data" rows="8">{"name":"Ada","customer":{"name":"Acme"},"total":1250,"date":"2026-08-27","items":[{"name":"Item A","price":100},{"name":"Item B","price":250}]}</textarea>
        </section>
        <section class="pg-panel pg-panel--grow">
          <h3>Document JSON</h3>
          <textarea id="json" class="json-view" readonly></textarea>
        </section>
      </aside>
    </div>
  </div>
</template>
