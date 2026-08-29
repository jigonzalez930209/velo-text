/**
 * Optional backend entry. No editor, no PDF writer, no npm deps.
 * Front apps should import `velo-text/editor-web` or `velo-text/vanilla` instead.
 */
export type { DocumentSlot, SlotKind } from "./types.js";
export { reportSlots } from "./walk.js";
export { dataFromSlotValues, assetsFromSlotValues } from "./inject.js";
