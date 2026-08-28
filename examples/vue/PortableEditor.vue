<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { mountVanillaEditor } from "portable-doc-editor";

const props = defineProps(["document", "theme", "editable", "resolveAssetUrl"]);
const emit = defineEmits(["update:document"]);
const el = ref(null);
let editor;
onMounted(() => {
  editor = mountVanillaEditor(el.value, {
    document: props.document,
    theme: props.theme,
    editable: props.editable,
    resolveAssetUrl: props.resolveAssetUrl,
    onChange: (doc) => emit("update:document", doc),
  });
});
onBeforeUnmount(() => editor?.destroy());
defineExpose({ insertVariable: (p) => editor?.commands.insertVariable(p), exportPdf: () => editor });
</script>
<template>
  <div ref="el"></div>
</template>
