import { Directive, ElementRef, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { mountVanillaEditor } from "velo-text";

/** Standalone directive: <div portableEditor [document]="doc" (documentChange)="onDoc($event)"></div> */
@Directive({ selector: "[portableEditor]", standalone: true })
export class PortableEditorDirective implements OnDestroy {
  @Input() document;
  @Input() theme = "light-neutral";
  @Input() editable = true;
  @Output() documentChange = new EventEmitter();
  editor;

  constructor(private el: ElementRef<HTMLElement>) {
    queueMicrotask(() => {
      this.editor = mountVanillaEditor(this.el.nativeElement, {
        document: this.document,
        theme: this.theme,
        editable: this.editable,
        onChange: (doc) => this.documentChange.emit(doc),
      });
    });
  }

  insertVariable(path, format, fallback) {
    this.editor?.commands.insertVariable(path, format, fallback);
  }

  getDocument() {
    return this.editor?.getDocument();
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }
}
