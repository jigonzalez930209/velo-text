import { Directive, ElementRef, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { mountVanillaEditor } from "portable-doc-editor";

@Directive({ selector: "[portableEditor]", standalone: true })
export class PortableEditorDirective implements OnDestroy {
  @Input() document;
  @Input() theme;
  @Output() documentChange = new EventEmitter();
  editor;
  constructor(el: ElementRef<HTMLElement>) {
    queueMicrotask(() => {
      this.editor = mountVanillaEditor(el.nativeElement, {
        document: this.document,
        theme: this.theme,
        onChange: (doc) => this.documentChange.emit(doc),
      });
    });
  }
  ngOnDestroy() { this.editor?.destroy(); }
}
