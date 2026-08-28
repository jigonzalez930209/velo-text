import { Component, ViewChild } from "@angular/core";
import { createDocument, createIdGenerator, exportDocument } from "velo-text";
import { PortableEditorDirective } from "./portable-editor";

const MIME = {
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function sampleDoc() {
  const g = createIdGenerator("ng");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
  doc.root.children.push({
    type: "paragraph",
    id: g.next(),
    children: [
      { type: "text", id: g.next(), text: "Hello " },
      { type: "variable", id: g.next(), path: "name", source: "{{name}}", valueType: "string" },
    ],
  });
  return doc;
}

@Component({
  standalone: true,
  selector: "app-root",
  imports: [PortableEditorDirective],
  template: `
    <div data-pde-theme="light-neutral">
      <p>{{ status }}</p>
      <button type="button" (click)="insertVar()">Insert variable</button>
      <button type="button" (click)="doExport('pdf')">PDF</button>
      <button type="button" (click)="doExport('odt')">ODT</button>
      <button type="button" (click)="doExport('docx')">DOCX</button>
      <div class="pde-editor" portableEditor [document]="doc" theme="light-neutral" (documentChange)="onChange($event)"></div>
    </div>
  `,
})
export class AppComponent {
  @ViewChild(PortableEditorDirective) editor;
  doc = sampleDoc();
  status = "ready";

  onChange(doc) {
    this.doc = doc;
    this.status = "changed";
  }

  insertVar() {
    this.editor?.insertVariable("name");
  }

  async doExport(format) {
    const document = this.editor?.getDocument() ?? this.doc;
    const chunks = [];
    await exportDocument({
      document,
      data: { name: "Ada" },
      format,
      sink: { write(c) { chunks.push(c); }, close() {} },
      options: { strict: false },
    });
    const a = window.document.createElement("a");
    a.href = URL.createObjectURL(new Blob(chunks, { type: MIME[format] }));
    a.download = `angular.${format}`;
    a.click();
    this.status = `exported ${format}`;
  }
}
