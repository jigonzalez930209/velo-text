import type { InlineNode, TextNode } from "../../core/model/types.js";

export interface PaginationVariables {
  pageNumber: number;
  totalPages: number;
  documentTitle: string;
  date: string;
}

export function substituteVarString(text: string, vars: PaginationVariables): string {
  return text
    .replace(/\{\{pageNumber\}\}/g, String(vars.pageNumber))
    .replace(/\{\{totalPages\}\}/g, String(vars.totalPages))
    .replace(/\{\{documentTitle\}\}/g, vars.documentTitle)
    .replace(/\{\{date\}\}/g, vars.date);
}

export function resolveDynamicVariables(nodes: InlineNode[], vars: PaginationVariables): InlineNode[] {
  const result: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      result.push({
        ...node,
        text: substituteVarString(node.text, vars),
      });
    } else if (node.type === "variable") {
      let val = "";
      if (node.path === "pageNumber" || node.source === "{{pageNumber}}") val = String(vars.pageNumber);
      else if (node.path === "totalPages" || node.source === "{{totalPages}}") val = String(vars.totalPages);
      else if (node.path === "documentTitle" || node.source === "{{documentTitle}}") val = vars.documentTitle;
      else if (node.path === "date" || node.source === "{{date}}") val = vars.date;
      else val = substituteVarString(node.fallback ?? node.source ?? "", vars);

      result.push({
        type: "text",
        id: node.id,
        text: val,
        marks: node.marks,
      } as TextNode);
    } else if (node.type === "link") {
      result.push({
        ...node,
        children: resolveDynamicVariables(node.children, vars) as Array<TextNode>,
      });
    } else {
      result.push(node);
    }
  }
  return result;
}

export function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text;
      if (n.type === "variable") return n.fallback ?? n.source ?? "";
      if (n.type === "link") return inlineNodesToText(n.children);
      return "";
    })
    .join("");
}
