<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { mountVanillaEditor } from "velo-text";

const props = defineProps({
  document: { type: Object, required: true },
  theme: { type: String, default: "light-neutral" },
  editable: { type: Boolean, default: true },
  resolveAssetUrl: { type: Function, default: undefined },
  getVariableCatalog: { type: Function, default: undefined },
  getTemplateData: { type: Function, default: undefined },
});
const emit = defineEmits(["update:document"]);
const el = ref(null);
let editor;

onMounted(() => {
  editor = mountVanillaEditor(el.value, {
    document: props.document,
    theme: props.theme,
    editable: props.editable,
    resolveAssetUrl: props.resolveAssetUrl,
    getVariableCatalog: props.getVariableCatalog,
    getTemplateData: props.getTemplateData,
    onChange: (doc) => emit("update:document", doc),
  });
});
onBeforeUnmount(() => editor?.destroy());

defineExpose({
  insertVariable: (path, format, fallback) => editor?.commands.insertVariable(path, format, fallback),
  getDocument: () => editor?.getDocument(),
  commands: () => editor?.commands,
});
</script>
<template>
  <div ref="el" class="pde-editor"></div>
</template>
