import type { DocumentFormat, PaperVariant, ParsedNote } from "./types";
import { fieldValue, stringifyValue } from "./note";

export interface EmbeddedImage {
  source: string;
  alt: string;
  data?: ArrayBuffer;
  mimeType?: "image/png" | "image/jpeg" | "image/gif" | "image/bmp";
  width?: number;
  height?: number;
}
export interface InlineSpan { text: string; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean; superscript?: boolean; math?: EmbeddedImage; }
export interface TableCellContent { spans: InlineSpan[]; images: EmbeddedImage[]; }
export interface MarkdownTable { rows: TableCellContent[][]; }
export type ContentBlock =
  | { kind: "heading"; level: number; spans: InlineSpan[] }
  | { kind: "paragraph"; spans: InlineSpan[] }
  | { kind: "image"; image: EmbeddedImage }
  | { kind: "table"; table: MarkdownTable };
export interface AddendumPage { title: InlineSpan[]; blocks: ContentBlock[]; }

export interface RenderedDocument {
  title: string;
  shortTitle: string;
  authors: string[];
  affiliations: string[];
  course: string;
  instructor: string;
  dueDate: string;
  authorNote: string;
  abstract: string;
  keywords: string[];
  blocks: ContentBlock[];
  references: InlineSpan[][];
  addenda: AddendumPage[];
  variant: PaperVariant;
  includeTitlePage: boolean;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export function plainText(spans: InlineSpan[]): string {
  return spans.map((span) => span.text).join("");
}

export function parseInline(source: string): InlineSpan[] {
  const normalized = source
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");
  const spans: InlineSpan[] = [];
  let buffer = "";
  let bold = false;
  let italic = false;
  let strike = false;
  let code = false;
  const flush = () => {
    if (!buffer) return;
    spans.push({ text: buffer, bold: bold || undefined, italic: italic || undefined, strike: strike || undefined, code: code || undefined });
    buffer = "";
  };
  for (let index = 0; index < normalized.length;) {
    const rest = normalized.slice(index);
    const inlineMath = /^\$([^$\n]+)\$/.exec(rest);
    if (inlineMath) { flush(); spans.push({ text: inlineMath[1], math: { source: `math-inline:${encodeURIComponent(inlineMath[1])}`, alt: inlineMath[1] } }); index += inlineMath[0].length; continue; }
    const superscript = /^\^(\d+(?:[-,]\d+)*)\^/.exec(rest);
    if (superscript) { flush(); spans.push({ text: superscript[1], superscript: true }); index += superscript[0].length; continue; }
    if (rest.startsWith("***") || rest.startsWith("___")) { flush(); bold = !bold; italic = !italic; index += 3; continue; }
    if (rest.startsWith("**") || rest.startsWith("__")) { flush(); bold = !bold; index += 2; continue; }
    if (rest.startsWith("~~")) { flush(); strike = !strike; index += 2; continue; }
    if (rest.startsWith("`")) { flush(); code = !code; index += 1; continue; }
    if (rest.startsWith("*") || rest.startsWith("_")) { flush(); italic = !italic; index += 1; continue; }
    buffer += normalized[index++];
  }
  flush();
  return spans.filter((span) => span.text.length > 0);
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  const text = stringifyValue(value).trim();
  return text ? text.split(/\s*;\s*/).filter(Boolean) : [];
}

function splitImages(source: string): { text: string; images: EmbeddedImage[] } {
  const images: EmbeddedImage[] = [];
  let text = source.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, path: string, alt?: string) => {
    images.push({ source: path.trim(), alt: (alt ?? path).trim() });
    return " ";
  });
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, path: string) => {
    images.push({ source: path.trim(), alt: (alt || path).trim() });
    return " ";
  });
  return { text: text.trim(), images };
}

function mixedBlocks(source: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const pattern = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|!\[([^\]]*)\]\(([^)]+)\)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = source.slice(cursor, index).trim();
    if (before) blocks.push({ kind: "paragraph", spans: parseInline(before) });
    const path = (match[1] ?? match[4]).trim();
    const alt = (match[2] ?? match[3] ?? path).trim();
    blocks.push({ kind: "image", image: { source: path, alt } });
    cursor = index + match[0].length;
  }
  const after = source.slice(cursor).trim();
  if (after) blocks.push({ kind: "paragraph", spans: parseInline(after) });
  return blocks.length ? blocks : [{ kind: "paragraph", spans: parseInline(source) }];
}

function splitTableRow(line: string): string[] {
  const source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "", wikiDepth = 0;
  for (let index = 0; index < source.length; index++) {
    if (source.startsWith("[[", index)) { wikiDepth++; cell += "[["; index++; continue; }
    if (source.startsWith("]]", index) && wikiDepth) { wikiDepth--; cell += "]]"; index++; continue; }
    if (source[index] === "\\" && source[index + 1] === "|") { cell += "|"; index++; continue; }
    if (source[index] === "|" && wikiDepth === 0) { cells.push(cell.trim()); cell = ""; continue; }
    cell += source[index];
  }
  cells.push(cell.trim());
  return cells;
}

function tableDelimiter(line: string): boolean {
  return splitTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTable(lines: string[]): MarkdownTable {
  const rows = lines.map((line) => splitTableRow(line).map((cell) => {
    const parsed = splitImages(cell.trim());
    return { spans: parseInline(parsed.text), images: parsed.images };
  }));
  const filtered = rows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(plainText(cell.spans).trim())));
  const columns = Math.max(1, ...filtered.map((row) => row.length));
  filtered.forEach((row) => { while (row.length < columns) row.push({ spans: [], images: [] }); });
  return { rows: filtered };
}

function parseMarkdown(markdown: string, title: string): { blocks: ContentBlock[]; references: InlineSpan[][]; addenda: AddendumPage[] } {
  const blocks: ContentBlock[] = [];
  const references: InlineSpan[][] = [];
  const addenda: AddendumPage[] = [];
  let inReferences = false;
  let currentAddendum: AddendumPage | null = null;
  let paragraph: string[] = [];
  const target = (): ContentBlock[] => currentAddendum ? currentAddendum.blocks : blocks;
  const flush = () => {
    const source = paragraph.join(" ").trim();
    paragraph = [];
    if (!source) return;
    if (inReferences && !currentAddendum) {
      const parsed = splitImages(source);
      references.push(parseInline(parsed.text));
      parsed.images.forEach((image) => references.push([{ text: `[Embedded image: ${image.alt}]` }]));
      return;
    }
    target().push(...mixedBlocks(source));
  };
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.startsWith("$$")) {
      flush();
      const mathLines: string[] = [];
      let first = line.slice(2), closed = false;
      if (first.endsWith("$$")) { first = first.slice(0, -2); closed = true; }
      if (first.trim()) mathLines.push(first);
      while (!closed && ++index < lines.length) {
        const candidate = lines[index];
        if (candidate.trim().endsWith("$$")) { mathLines.push(candidate.replace(/\$\$\s*$/, "")); closed = true; }
        else mathLines.push(candidate);
      }
      const tex = mathLines.join("\n").trim();
      target().push({ kind: "image", image: { source: `math-display:${encodeURIComponent(tex)}`, alt: tex } });
      continue;
    }
    const heading = /^(#{1,5})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const headingSpans = parseInline(heading[2].trim());
      const headingText = plainText(headingSpans);
      if (/^(references?|works cited|bibliography)$/i.test(headingText)) { inReferences = true; currentAddendum = null; continue; }
      if (inReferences) {
        currentAddendum = { title: headingSpans, blocks: [] };
        addenda.push(currentAddendum);
        continue;
      }
      if (headingText.toLowerCase() === title.toLowerCase() && blocks.length === 0) continue;
      blocks.push({ kind: "heading", level: heading[1].length, spans: headingSpans });
      continue;
    }
    const nextLine = lines[index + 1]?.trim() ?? "";
    const startsTable = line.includes("|") && (tableDelimiter(nextLine) || (index > 0 && tableDelimiter(lines[index - 1].trim())));
    if (startsTable) {
      flush();
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().includes("|")) tableLines.push(lines[index++].trim());
      index--;
      target().push({ kind: "table", table: parseTable(tableLines) });
      continue;
    }
    if (!line) { flush(); continue; }
    paragraph.push(line.replace(/^[-+]\s+/, ""));
  }
  flush();
  return { blocks, references, addenda };
}

function spansHtml(spans: InlineSpan[]): string {
  return spans.map((span) => {
    let text = escapeHtml(span.text);
    if (span.code) text = `<code>${text}</code>`;
    if (span.strike) text = `<s>${text}</s>`;
    if (span.italic) text = `<em>${text}</em>`;
    if (span.bold) text = `<strong>${text}</strong>`;
    if (span.superscript) text = `<sup>${text}</sup>`;
    return text;
  }).join("");
}

function htmlForBlock(block: ContentBlock): string {
  if (block.kind === "heading") return `<h${Math.min(block.level, 5)}>${spansHtml(block.spans)}</h${Math.min(block.level, 5)}>`;
  if (block.kind === "paragraph") return `<p>${spansHtml(block.spans)}</p>`;
  if (block.kind === "image") return `<p class="image"><img src="${escapeHtml(block.image.source)}" alt="${escapeHtml(block.image.alt)}"></p>`;
  return `<table>${block.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${spansHtml(cell.spans)}${cell.images.map((image) => `<img src="${escapeHtml(image.source)}" alt="${escapeHtml(image.alt)}">`).join("")}</td>`).join("")}</tr>`).join("")}</table>`;
}

function sourceListTitle(format: DocumentFormat, variant: PaperVariant): string {
  if (format.id === "mla-9") return "Works Cited";
  if (format.id === "chicago-18") return variant.id === "notes-bibliography" ? "Bibliography" : "References";
  if (format.id === "harvard-thesis") return "Bibliography";
  return "References";
}

export function renderDocument(note: ParsedNote, format: DocumentFormat, variantId: string, options: Record<string, boolean>): RenderedDocument {
  const get = (key: string) => fieldValue(note, key);
  const title = stringifyValue(get("Title")) || "Untitled";
  const parsed = parseMarkdown(note.body, title);
  const frontmatterReferences = listValue(get("References") ?? get("WorksCited")).map(parseInline);
  const variant = format.variants.find((item) => item.id === variantId) ?? format.variants[0];
  const structuredAma = format.id === "ama-11" && variant.id === "structured-abstract";
  const structuredFields: [string, unknown][] = [
    ["Importance", get("Importance")], ["Objective", get("Objective")], ["Design, Setting, and Participants", get("DesignSettingParticipants")],
    ["Main Outcomes and Measures", get("MainOutcomesMeasures")], ["Results", get("Results")], ["Conclusions and Relevance", get("ConclusionsRelevance")]
  ];
  const structuredAbstract = structuredAma ? structuredFields.filter(([, value]) => stringifyValue(value)).map(([label, value]) => `${label}: ${stringifyValue(value)}`).join("\n") : "";
  const rendered: RenderedDocument = {
    title,
    shortTitle: (stringifyValue(get("ShortTitle")) || title).toUpperCase(),
    authors: listValue(get("Author") ?? get("Authors")),
    affiliations: listValue(get("Affiliation")),
    course: stringifyValue(get("Course")),
    instructor: stringifyValue(get("Instructor")),
    dueDate: stringifyValue(get("DueDate") ?? get("Date")),
    authorNote: options.includeAuthorNote === false ? "" : stringifyValue(get("AuthorNote")),
    abstract: options.includeAbstract === false ? "" : structuredAbstract || stringifyValue(get("Abstract")),
    keywords: listValue(get("Keywords")),
    blocks: parsed.blocks,
    references: parsed.references.length ? parsed.references : frontmatterReferences,
    addenda: parsed.addenda,
    variant,
    includeTitlePage: format.id === "mla-9" ? options.includeFirstPageHeading !== false : format.id === "ieee-conference" ? false : options.includeTitlePage !== false,
    html: ""
  };
  const mla = format.id === "mla-9";
  const css = `@page{size:letter;margin:1in}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:2;max-width:6.5in;margin:auto}p{margin:0;text-indent:.5in}h1,h2,h3,h4,h5{font-size:12pt;margin:0;line-height:2}h1{text-align:center;font-weight:bold}h2{text-align:left;font-weight:bold}h3{text-align:left;font-style:italic;font-weight:bold}.title-page{text-align:center;break-after:page;padding-top:.75in}.title-page p{text-indent:0}.title{font-weight:bold;margin-bottom:24pt}.mla-heading p{text-indent:0}.mla-title{text-align:center;text-indent:0}.abstract{break-after:page}.abstract p{text-indent:0}.paper-title{text-align:center;font-weight:bold;text-indent:0}.references,.addendum{break-before:page}.references p{padding-left:.5in;text-indent:-.5in}.addendum-title{font-weight:bold;text-indent:0}.addendum img{display:block;max-height:7in;max-width:100%;object-fit:contain}.addendum table{border-collapse:collapse;line-height:1.2;width:100%}.addendum td{border-bottom:1px solid #000;padding:4pt}`;
  const studentLines = [...rendered.authors, ...rendered.affiliations, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean);
  const professionalLines = [...rendered.authors, ...rendered.affiliations].filter(Boolean);
  const titlePage = mla ? `<section class="mla-heading">${rendered.includeTitlePage ? [...rendered.authors, rendered.instructor, rendered.course, rendered.dueDate].filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("") : ""}<p class="mla-title">${escapeHtml(title)}</p></section>` : rendered.includeTitlePage ? `<section class="title-page"><p class="title">${escapeHtml(title)}</p>${(format.id === "apa-7-student" ? studentLines : professionalLines).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}${rendered.authorNote ? `<h1>Author Note</h1><p>${escapeHtml(rendered.authorNote)}</p>` : ""}</section>` : "";
  const abstract = rendered.abstract ? `<section class="abstract"><h1>Abstract</h1><p>${escapeHtml(rendered.abstract)}</p>${rendered.keywords.length ? `<p><em>Keywords:</em> ${escapeHtml(rendered.keywords.join(", "))}</p>` : ""}</section>` : "";
  const body = `<main>${mla ? "" : `<p class="paper-title">${escapeHtml(title)}</p>`}${rendered.blocks.map(htmlForBlock).join("")}</main>`;
  const references = `<section class="references"><h1>${sourceListTitle(format, variant)}</h1>${rendered.references.map((entry) => `<p>${spansHtml(entry)}</p>`).join("")}</section>`;
  const addenda = rendered.addenda.map((page) => `<section class="addendum"><p class="addendum-title">${spansHtml(page.title)}</p>${page.blocks.map(htmlForBlock).join("")}</section>`).join("");
  rendered.html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${titlePage}${abstract}${body}${references}${addenda}</body></html>`;
  return rendered;
}
