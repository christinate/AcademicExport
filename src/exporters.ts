import {
  AlignmentType, BorderStyle, Document, Header, ImageRun, Packer, PageBreak, PageNumber,
  Paragraph, Table, TableCell, TableRow, TabStopPosition, TabStopType, TextRun,
  VerticalAlign, WidthType, SectionType
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import serifRegular from "../assets/fonts/LiberationSerif-Regular.ttf?inline";
import type { OutputType } from "./config";
import type { DocumentFormat } from "./types";
import type { AddendumPage, ContentBlock, EmbeddedImage, InlineSpan, MarkdownTable, RenderedDocument } from "./render";

export interface ExportArtifact { extension: OutputType; data: ArrayBuffer; }
const encode = (value: string) => new TextEncoder().encode(value).buffer;
const HALF_POINTS = 24;
const DOUBLE_LINE = 480;
const HALF_INCH = 720;
const CONTENT_DXA = 9360;
const INLINE_MATH_HEIGHT = 18;
const DISPLAY_MATH_HEIGHT = 36;
const WORD_INLINE_MATH_HEIGHT = 24;
const WORD_DISPLAY_MATH_HEIGHT = 54;
const spansText = (spans: InlineSpan[]) => spans.map((span) => span.text).join("");

function wordRun(span: InlineSpan, overrides: { bold?: boolean; italic?: boolean } = {}): TextRun | ImageRun {
  if (span.math) {
    const height = WORD_INLINE_MATH_HEIGHT, width = Math.max(4, Math.round(height * ((span.math.width ?? height) / (span.math.height ?? height))));
    return wordImage(span.math, width, height);
  }
  return new TextRun({
    text: span.text,
    font: span.code ? "Courier New" : "Times New Roman",
    size: HALF_POINTS,
    bold: overrides.bold || span.bold || undefined,
    italics: overrides.italic || span.italic || undefined,
    strike: span.strike,
    superScript: span.superscript,
    color: "000000"
  });
}

function wordRuns(spans: InlineSpan[], overrides: { bold?: boolean; italic?: boolean } = {}): (TextRun | ImageRun)[] {
  return spans.map((span) => wordRun(span, overrides));
}

function textParagraph(spans: InlineSpan[], options: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; italic?: boolean; firstLine?: boolean; hanging?: boolean; before?: number; after?: number; keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: wordRuns(spans, options),
    alignment: options.alignment,
    spacing: { line: DOUBLE_LINE, before: options.before ?? 0, after: options.after ?? 0 },
    indent: options.hanging ? { left: HALF_INCH, hanging: HALF_INCH } : options.firstLine ? { firstLine: HALF_INCH } : undefined,
    keepNext: options.keepNext
  });
}

function paragraph(text = "", options: Parameters<typeof textParagraph>[1] = {}): Paragraph {
  return textParagraph([{ text }], options);
}

function heading(block: Extract<ContentBlock, { kind: "heading" }>): Paragraph {
  if (block.level === 1) return textParagraph(block.spans, { alignment: AlignmentType.CENTER, bold: true, keepNext: true });
  if (block.level === 2) return textParagraph(block.spans, { bold: true, keepNext: true });
  if (block.level === 3) return textParagraph(block.spans, { bold: true, italic: true, keepNext: true });
  const spans = [...block.spans];
  if (!spansText(spans).endsWith(".")) spans.push({ text: "." });
  return textParagraph(spans, { bold: true, italic: block.level >= 5, firstLine: true, keepNext: true });
}

function pageBreak(): Paragraph { return new Paragraph({ children: [new PageBreak()] }); }

function mlaSurname(rendered: RenderedDocument): string {
  const author = rendered.authors[0]?.trim() ?? "";
  const names = author.split(/\s+/);
  return names[names.length - 1] ?? "";
}

function referenceTitle(format: DocumentFormat, rendered: RenderedDocument): string {
  if (format.id === "mla-9") return "Works Cited";
  if (format.id === "chicago-18") return rendered.variant.id === "notes-bibliography" ? "Bibliography" : "References";
  if (format.id === "harvard-thesis") return "Bibliography";
  if (format.id === "harvard-author-date") return "References";
  return "References";
}

function plainReferenceHeading(format: DocumentFormat): boolean {
  return ["mla-9", "chicago-18", "harvard-thesis", "harvard-author-date"].includes(format.id);
}

function header(rendered: RenderedDocument, professional: boolean, mla = false): Header {
  const children: (TextRun | ImageRun)[] = [];
  if (professional) children.push(wordRun({ text: rendered.shortTitle }), wordRun({ text: "\t" }));
  if (mla && mlaSurname(rendered)) children.push(wordRun({ text: `${mlaSurname(rendered)} ` }));
  children.push(new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: HALF_POINTS }));
  return new Header({ children: [new Paragraph({
    children,
    alignment: professional ? AlignmentType.LEFT : AlignmentType.RIGHT,
    tabStops: professional ? [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }] : undefined,
    spacing: { line: DOUBLE_LINE, after: 0 }
  })] });
}

function titlePage(rendered: RenderedDocument, professional: boolean): Paragraph[] {
  const metadata = professional ? [...rendered.authors, ...rendered.affiliations] : [...rendered.authors, ...rendered.affiliations, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean);
  const children = [paragraph(rendered.title, { alignment: AlignmentType.CENTER, bold: true, before: 1440, after: DOUBLE_LINE })];
  metadata.forEach((line) => children.push(paragraph(line, { alignment: AlignmentType.CENTER })));
  if (professional && rendered.authorNote) {
    children.push(paragraph("Author Note", { alignment: AlignmentType.CENTER, bold: true, before: 960 }));
    children.push(paragraph(rendered.authorNote, { firstLine: true }));
  }
  return children;
}

function abstractPage(rendered: RenderedDocument): Paragraph[] {
  if (!rendered.abstract) return [];
  const abstractLines = rendered.abstract.split(/\r?\n/).filter(Boolean);
  const children = [paragraph("Abstract", { alignment: AlignmentType.CENTER, bold: true }), ...abstractLines.map((line) => {
    const match = /^([^:]+):(.*)$/.exec(line);
    return match ? textParagraph([{ text: `${match[1]}:`, bold: true }, { text: match[2] }]) : paragraph(line);
  })];
  if (rendered.keywords.length) children.push(textParagraph([{ text: "Keywords:", italic: true }, { text: ` ${rendered.keywords.join(", ")}` }], { firstLine: true }));
  return children;
}

function imageScale(image: EmbeddedImage, maxWidthPx: number, maxHeightPx: number): { width: number; height: number } {
  if (!image.width || !image.height) throw new Error(`Image dimensions are unavailable: ${image.source}`);
  const scale = Math.min(1, maxWidthPx / image.width, maxHeightPx / image.height);
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) };
}

function wordImage(image: EmbeddedImage, maxWidthPx = 624, maxHeightPx = 648): ImageRun {
  if (!image.data || !image.mimeType) throw new Error(`Image data is unavailable: ${image.source}`);
  const type = image.mimeType.split("/")[1] as "png" | "jpg" | "gif" | "bmp";
  const limits = image.source.startsWith("math-display:") ? { width: Math.min(maxWidthPx, 520), height: Math.min(maxHeightPx, WORD_DISPLAY_MATH_HEIGHT) } : { width: maxWidthPx, height: maxHeightPx };
  return new ImageRun({ data: new Uint8Array(image.data), type, transformation: imageScale(image, limits.width, limits.height), altText: { title: image.alt, description: image.alt, name: image.alt } });
}

function wordImageParagraph(image: EmbeddedImage, maxWidthPx?: number, maxHeightPx?: number): Paragraph {
  return new Paragraph({ children: [wordImage(image, maxWidthPx, maxHeightPx)], alignment: AlignmentType.CENTER, spacing: { line: DOUBLE_LINE, after: 0 } });
}

function wordTable(table: MarkdownTable): Table {
  const columnCount = Math.max(1, ...table.rows.map((row) => row.length));
  const columnWidth = Math.floor(CONTENT_DXA / columnCount);
  const nil = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
  const single = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  return new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: Array(columnCount).fill(columnWidth),
    borders: { top: single, bottom: single, left: nil, right: nil, insideVertical: nil, insideHorizontal: nil },
    rows: table.rows.map((row, rowIndex) => new TableRow({
      tableHeader: rowIndex === 0,
      children: row.map((cell, cellIndex) => new TableCell({
        width: { size: columnWidth, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        borders: rowIndex === 0 ? { bottom: single } : undefined,
        children: [
          textParagraph(cell.spans, { alignment: cellIndex === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, bold: rowIndex === 0 }),
          ...cell.images.map((image) => wordImageParagraph(image, Math.max(48, Math.floor(624 / columnCount) - 12), 240))
        ]
      }))
    }))
  });
}

function appendWordBlock(children: (Paragraph | Table)[], block: ContentBlock, addendum = false): void {
  if (block.kind === "heading") children.push(heading(block));
  else if (block.kind === "paragraph") children.push(textParagraph(block.spans, { firstLine: !addendum }));
  else if (block.kind === "image") children.push(wordImageParagraph(block.image));
  else children.push(wordTable(block.table));
}

async function toDocx(rendered: RenderedDocument, format: DocumentFormat): Promise<ArrayBuffer> {
  const professional = format.id === "apa-7-professional";
  const mla = format.id === "mla-9";
  const children: (Paragraph | Table)[] = [];
  if (mla) {
    if (rendered.includeTitlePage) [...rendered.authors, rendered.instructor, rendered.course, rendered.dueDate].filter(Boolean).forEach((line) => children.push(paragraph(line)));
    children.push(paragraph(rendered.title, { alignment: AlignmentType.CENTER }));
  } else {
    if (rendered.includeTitlePage) {
      if (format.id === "chicago-18") {
        children.push(paragraph(rendered.title, { alignment: AlignmentType.CENTER, bold: true, before: 1440, after: DOUBLE_LINE }));
        [...rendered.authors, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean).forEach((line) => children.push(paragraph(line, { alignment: AlignmentType.CENTER })));
        children.push(pageBreak());
      } else if (format.id === "harvard-thesis") {
        children.push(paragraph(rendered.title, { alignment: AlignmentType.CENTER, bold: true, before: 960, after: 960 }));
        rendered.authors.forEach((author) => children.push(paragraph(author, { alignment: AlignmentType.CENTER })));
        children.push(paragraph(`A Thesis in the Field of ${rendered.affiliations[0] ?? ""}`, { alignment: AlignmentType.CENTER, before: 720 }));
        children.push(paragraph("for the Degree of Master of Liberal Arts in Extension Studies", { alignment: AlignmentType.CENTER }));
        children.push(paragraph("Harvard University", { alignment: AlignmentType.CENTER, before: 720 }));
        children.push(paragraph(rendered.dueDate, { alignment: AlignmentType.CENTER }));
        children.push(pageBreak());
      } else children.push(...titlePage(rendered, professional), pageBreak());
    }
    if (rendered.abstract) children.push(...abstractPage(rendered), pageBreak());
    if (!["chicago-18", "harvard-thesis"].includes(format.id) || !rendered.includeTitlePage) children.push(paragraph(rendered.title, { alignment: AlignmentType.CENTER, bold: true }));
  }
  rendered.blocks.forEach((block) => appendWordBlock(children, block));
  children.push(pageBreak(), paragraph(referenceTitle(format, rendered), { alignment: AlignmentType.CENTER, bold: !plainReferenceHeading(format) }));
  rendered.references.forEach((reference) => children.push(textParagraph(reference, { hanging: true })));
  for (const addendum of rendered.addenda) {
    children.push(pageBreak(), textParagraph(addendum.title, { bold: true, keepNext: true }));
    addendum.blocks.forEach((block) => appendWordBlock(children, block, true));
  }
  const doc = new Document({
    creator: "Academic Export", title: rendered.title, description: `${format.name} - ${rendered.variant.name}`,
    styles: { default: {
      document: { run: { font: "Times New Roman", size: HALF_POINTS, color: "000000" }, paragraph: { spacing: { line: DOUBLE_LINE, after: 0 } } },
      heading1: { run: { font: "Times New Roman", size: HALF_POINTS, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { line: DOUBLE_LINE, after: 0 } } },
      heading2: { run: { font: "Times New Roman", size: HALF_POINTS, bold: true }, paragraph: { spacing: { line: DOUBLE_LINE, after: 0 } } },
      heading3: { run: { font: "Times New Roman", size: HALF_POINTS, bold: true, italics: true }, paragraph: { spacing: { line: DOUBLE_LINE, after: 0 } } }
    } },
    sections: [{
      properties: { titlePage: ["chicago-18", "harvard-thesis", "harvard-author-date"].includes(format.id) && rendered.includeTitlePage, page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 } } },
      headers: { default: header(rendered, professional || format.id === "ama-11", mla), first: new Header({ children: [] }) }, children
    }]
  });
  return Packer.toBuffer(doc).then((buffer) => Uint8Array.from(buffer).buffer);
}

function ieeeRuns(spans: InlineSpan[], size = 20, bold = false): (TextRun | ImageRun)[] {
  return spans.map((span) => {
    if (span.math) { const height = 15, width = Math.max(4, Math.round(height * ((span.math.width ?? height) / (span.math.height ?? height)))); return wordImage(span.math, width, height); }
    return new TextRun({ text: span.text, font: span.code ? "Courier New" : "Times New Roman", size, bold: bold || span.bold || undefined, italics: span.italic || undefined, strike: span.strike, superScript: span.superscript, color: "000000" });
  });
}
function ieeeParagraph(spans: InlineSpan[], options: { size?: number; bold?: boolean; center?: boolean; firstLine?: boolean; before?: number; after?: number; keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({ children: ieeeRuns(spans, options.size, options.bold), alignment: options.center ? AlignmentType.CENTER : undefined, indent: options.firstLine ? { firstLine: 230 } : undefined, spacing: { line: 200, before: options.before ?? 0, after: options.after ?? 0 }, keepNext: options.keepNext });
}
function appendIeeeBlock(children: (Paragraph | Table)[], block: ContentBlock): void {
  if (block.kind === "heading") children.push(ieeeParagraph(block.spans, { bold: true, center: block.level === 1, before: 120, keepNext: true }));
  else if (block.kind === "paragraph") children.push(ieeeParagraph(block.spans, { firstLine: true }));
  else if (block.kind === "image") children.push(wordImageParagraph(block.image, 310, 500));
  else children.push(wordTable(block.table));
}
async function toIeeeDocx(rendered: RenderedDocument, format: DocumentFormat): Promise<ArrayBuffer> {
  const front: Paragraph[] = [ieeeParagraph([{ text: rendered.title }], { size: 32, center: true, after: 120, keepNext: true })];
  rendered.authors.forEach((author) => front.push(ieeeParagraph([{ text: author }], { size: 22, center: true })));
  rendered.affiliations.forEach((affiliation) => front.push(ieeeParagraph([{ text: affiliation }], { size: 18, center: true })));
  if (rendered.abstract) front.push(ieeeParagraph([{ text: "Abstract—", bold: true }, { text: rendered.abstract }], { size: 18, before: 120 }));
  if (rendered.keywords.length) front.push(ieeeParagraph([{ text: "Index Terms—", bold: true }, { text: rendered.keywords.join(", ") }], { size: 18 }));
  const body: (Paragraph | Table)[] = [];
  rendered.blocks.forEach((block) => appendIeeeBlock(body, block));
  body.push(ieeeParagraph([{ text: "REFERENCES" }], { bold: true, center: true, before: 120, keepNext: true }));
  rendered.references.forEach((reference) => body.push(ieeeParagraph(reference)));
  const margin = 540;
  const doc = new Document({ creator: "Academic Export", title: rendered.title, description: `${format.name} - ${rendered.variant.name}`, sections: [
    { properties: { type: SectionType.CONTINUOUS, page: { size: { width: 12240, height: 15840 }, margin: { top: margin, right: margin, bottom: margin, left: margin, header: 360, footer: 360 } } }, children: front },
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: margin, right: margin, bottom: margin, left: margin, header: 360, footer: 360 } }, column: { count: 2, equalWidth: true, space: 360 } }, children: body }
  ] });
  return Packer.toBuffer(doc).then((buffer) => Uint8Array.from(buffer).buffer);
}

type PdfFonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont; code: PDFFont };
type PdfState = { pdf: PDFDocument; page: PDFPage; fonts: PdfFonts; y: number; pages: PDFPage[]; rendered: RenderedDocument; professional: boolean; mla: boolean; mathImages: Map<string, PDFImage> };
type PdfToken = { text: string; font: PDFFont; strike?: boolean; superscript?: boolean; image?: EmbeddedImage };
// Word's 2.0 line-spacing setting doubles the typeface's full line box, not
// merely the nominal 12-point font size. A 28-point PDF baseline matches the
// Times-compatible 12-point double spacing produced by Word/LibreOffice.
const PAGE_WIDTH = 612, PAGE_HEIGHT = 792, MARGIN = 72, FONT_SIZE = 12, LINE_HEIGHT = 28, CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP_BASELINE = PAGE_HEIGHT - MARGIN - FONT_SIZE;

function fontBytes(base64: string): Uint8Array {
  const binary = atob(base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function embedPdfFonts(pdf: PDFDocument): Promise<PdfFonts> {
  pdf.registerFontkit(fontkit);
  const [regular, bold, italic, boldItalic, code] = await Promise.all([
    pdf.embedFont(fontBytes(serifRegular), { subset: true }), pdf.embedFont(StandardFonts.TimesRomanBold),
    pdf.embedFont(StandardFonts.TimesRomanItalic), pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    pdf.embedFont(StandardFonts.Courier)
  ]);
  return { regular, bold, italic, boldItalic, code };
}

function supportedPdfFont(preferred: PDFFont, fallback: PDFFont, text: string): PDFFont {
  try { preferred.encodeText(text); return preferred; } catch { return fallback; }
}

function addPdfPage(state: PdfState): void { state.page = state.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); state.pages.push(state.page); state.y = BODY_TOP_BASELINE; }
function pdfFont(state: PdfState, span: InlineSpan, force?: { bold?: boolean; italic?: boolean }): PDFFont {
  if (span.code) return state.fonts.code;
  const bold = force?.bold || span.bold, italic = force?.italic || span.italic;
  return bold && italic ? state.fonts.boldItalic : bold ? state.fonts.bold : italic ? state.fonts.italic : state.fonts.regular;
}
function tokens(state: PdfState, spans: InlineSpan[], force?: { bold?: boolean; italic?: boolean }): PdfToken[] {
  const result: PdfToken[] = [];
  for (const span of spans) {
    if (span.math) result.push({ text: "", font: state.fonts.regular, image: span.math });
    else span.text.replace(/\s+/g, " ").split(/(\s+)/).filter(Boolean).forEach((text) => result.push({ text, font: supportedPdfFont(pdfFont(state, span, force), state.fonts.regular, text), strike: span.strike, superscript: span.superscript }));
  }
  return result;
}
function tokenWidth(item: PdfToken): number { return item.image ? INLINE_MATH_HEIGHT * ((item.image.width ?? INLINE_MATH_HEIGHT) / (item.image.height ?? INLINE_MATH_HEIGHT)) : item.font.widthOfTextAtSize(item.text, FONT_SIZE); }
function lineWidth(items: PdfToken[]): number { return items.reduce((sum, item) => sum + tokenWidth(item), 0); }
function richLines(items: PdfToken[], firstWidth: number, laterWidth: number): PdfToken[][] {
  const lines: PdfToken[][] = [[]]; let width = 0;
  for (const item of items) {
    const itemWidth = tokenWidth(item);
    const limit = lines.length === 1 ? firstWidth : laterWidth;
    const currentLine = lines[lines.length - 1];
    if (width + itemWidth > limit && currentLine.some((token: PdfToken) => token.text.trim())) { lines.push([]); width = 0; if (!item.text.trim()) continue; }
    lines[lines.length - 1].push(item); width += itemWidth;
  }
  return lines;
}
function ensurePdfSpace(state: PdfState, lines = 1): void { if (state.y - (lines - 1) * LINE_HEIGHT - FONT_SIZE < MARGIN) addPdfPage(state); }
function drawRich(state: PdfState, spans: InlineSpan[], options: { align?: "left" | "center"; firstIndent?: number; hanging?: number; bold?: boolean; italic?: boolean } = {}): void {
  const firstIndent = options.firstIndent ?? 0, hanging = options.hanging ?? 0;
  const lines = richLines(tokens(state, spans, options), CONTENT_WIDTH - firstIndent, CONTENT_WIDTH - hanging);
  lines.forEach((line, index) => {
    ensurePdfSpace(state);
    let x = MARGIN + (index === 0 ? firstIndent : hanging);
    if (options.align === "center") x = (PAGE_WIDTH - lineWidth(line)) / 2;
    for (const item of line) {
      const width = tokenWidth(item);
      if (item.image) {
        const embedded = state.mathImages.get(item.image.source); if (!embedded) throw new Error(`Math image was not prepared: ${item.image.alt}`);
        state.page.drawImage(embedded, { x, y: state.y - 1, width, height: INLINE_MATH_HEIGHT });
      } else state.page.drawText(item.text, { x, y: state.y + (item.superscript ? 5 : 0), size: item.superscript ? 8 : FONT_SIZE, font: item.font, color: rgb(0, 0, 0) });
      if (item.strike) state.page.drawLine({ start: { x, y: state.y + 4 }, end: { x: x + width, y: state.y + 4 }, thickness: 0.7, color: rgb(0, 0, 0) });
      x += width;
    }
    state.y -= LINE_HEIGHT;
  });
}
function drawText(state: PdfState, text: string, options: Parameters<typeof drawRich>[2] = {}): void { drawRich(state, [{ text }], options); }
function drawPdfHeading(state: PdfState, block: Extract<ContentBlock, { kind: "heading" }>): void {
  const spans = [...block.spans]; if (block.level >= 4 && !spansText(spans).endsWith(".")) spans.push({ text: "." });
  drawRich(state, spans, { bold: true, italic: block.level === 3 || block.level === 5, align: block.level === 1 ? "center" : "left", firstIndent: block.level >= 4 ? 36 : 0 });
}
function drawPdfKeywords(state: PdfState, keywords: string[]): void { drawRich(state, [{ text: "Keywords:", italic: true }, { text: ` ${keywords.join(", ")}` }], { firstIndent: 36 }); }
function drawPdfHeaders(state: PdfState, skipFirst = false): void {
  state.pages.forEach((page, index) => {
    if (skipFirst && index === 0) return;
    if (state.professional) page.drawText(state.rendered.shortTitle, { x: MARGIN, y: 756, size: FONT_SIZE, font: state.fonts.regular });
    const number = state.mla ? `${mlaSurname(state.rendered)} ${index + 1}`.trim() : String(index + 1); page.drawText(number, { x: PAGE_WIDTH - MARGIN - state.fonts.regular.widthOfTextAtSize(number, FONT_SIZE), y: 756, size: FONT_SIZE, font: state.fonts.regular });
  });
}
async function pdfImage(state: PdfState, image: EmbeddedImage): Promise<PDFImage> {
  if (!image.data || !image.mimeType) throw new Error(`Image data is unavailable: ${image.source}`);
  if (image.mimeType === "image/png") return state.pdf.embedPng(image.data);
  if (image.mimeType === "image/jpeg") return state.pdf.embedJpg(image.data);
  throw new Error(`PDF export supports PNG and JPEG images: ${image.source}`);
}
async function drawPdfImage(state: PdfState, image: EmbeddedImage, maxWidth = CONTENT_WIDTH, maxHeight?: number): Promise<void> {
  const embedded = await pdfImage(state, image);
  const availableHeight = image.source.startsWith("math-display:") ? Math.min(DISPLAY_MATH_HEIGHT, maxHeight ?? DISPLAY_MATH_HEIGHT) : maxHeight ?? Math.max(72, state.y - MARGIN - LINE_HEIGHT);
  const scale = Math.min(1, maxWidth / embedded.width, availableHeight / embedded.height);
  const width = embedded.width * scale, height = embedded.height * scale;
  if (state.y - height < MARGIN) addPdfPage(state);
  state.page.drawImage(embedded, { x: (PAGE_WIDTH - width) / 2, y: state.y - height, width, height });
  state.y -= height + LINE_HEIGHT;
}
function cellLines(state: PdfState, spans: InlineSpan[], width: number, bold: boolean): PdfToken[][] { return richLines(tokens(state, spans, { bold }), width, width); }
async function drawPdfTable(state: PdfState, table: MarkdownTable): Promise<void> {
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const columnWidth = CONTENT_WIDTH / columns;
  state.page.drawLine({ start: { x: MARGIN, y: state.y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: state.y + 6 }, thickness: 1 });
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const row = table.rows[rowIndex];
    const wrapped = row.map((cell) => cellLines(state, cell.spans, columnWidth - 8, rowIndex === 0));
    const imageHeights = row.map((cell) => cell.images.reduce((sum, image) => sum + (image.height && image.width ? Math.min(180, image.height * Math.min(1, (columnWidth - 8) / image.width)) + 4 : 0), 0));
    // APA table rules sit outside the cell content. Reserve enough vertical
    // padding that neither the top/header rule nor the following row can cross
    // a glyph, including wrapped header labels.
    const rowHeight = Math.max(...wrapped.map((lines, index) => lines.length * 14 + imageHeights[index]), 18) + 22;
    if (state.y - rowHeight < MARGIN) { addPdfPage(state); state.page.drawLine({ start: { x: MARGIN, y: state.y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: state.y + 6 }, thickness: 1 }); }
    for (let column = 0; column < row.length; column++) {
      let y = state.y - 10; const xStart = MARGIN + column * columnWidth + 4;
      for (const line of wrapped[column]) {
        let x = xStart; for (const item of line) { state.page.drawText(item.text, { x, y, size: FONT_SIZE, font: item.font }); x += item.font.widthOfTextAtSize(item.text, FONT_SIZE); } y -= 14;
      }
      for (const image of row[column].images) {
        const embedded = await pdfImage(state, image); const scale = Math.min(1, (columnWidth - 8) / embedded.width, 180 / embedded.height);
        state.page.drawImage(embedded, { x: xStart, y: y - embedded.height * scale, width: embedded.width * scale, height: embedded.height * scale }); y -= embedded.height * scale + 4;
      }
    }
    state.y -= rowHeight;
    if (rowIndex === 0) state.page.drawLine({ start: { x: MARGIN, y: state.y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: state.y + 4 }, thickness: 1 });
  }
  state.page.drawLine({ start: { x: MARGIN, y: state.y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: state.y + 4 }, thickness: 1 });
  state.y -= 8;
}
async function drawPdfBlock(state: PdfState, block: ContentBlock, addendum = false): Promise<void> {
  if (block.kind === "heading") drawPdfHeading(state, block);
  else if (block.kind === "paragraph") drawRich(state, block.spans, { firstIndent: addendum ? 0 : 36 });
  else if (block.kind === "image") await drawPdfImage(state, block.image);
  else await drawPdfTable(state, block.table);
}
async function drawPdfAddendum(state: PdfState, addendum: AddendumPage): Promise<void> {
  addPdfPage(state); drawRich(state, addendum.title, { bold: true });
  for (const block of addendum.blocks) await drawPdfBlock(state, block, true);
}

async function toPdf(rendered: RenderedDocument, format: DocumentFormat): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const fonts = await embedPdfFonts(pdf);
  const first = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const mla = format.id === "mla-9";
  const mathImages = new Map<string, PDFImage>();
  const collect = (spans: InlineSpan[]) => spans.forEach((span) => { if (span.math?.data && !mathImages.has(span.math.source)) mathImages.set(span.math.source, undefined as unknown as PDFImage); });
  rendered.blocks.forEach((block) => { if (block.kind === "heading" || block.kind === "paragraph") collect(block.spans); else if (block.kind === "table") block.table.rows.forEach((row) => row.forEach((cell) => collect(cell.spans))); });
  rendered.references.forEach(collect); rendered.addenda.forEach((page) => page.blocks.forEach((block) => { if (block.kind === "heading" || block.kind === "paragraph") collect(block.spans); }));
  for (const source of [...mathImages.keys()]) {
    const find = (spans: InlineSpan[]) => spans.find((span) => span.math?.source === source)?.math;
    let image: EmbeddedImage | undefined;
    for (const block of rendered.blocks) { if (block.kind === "heading" || block.kind === "paragraph") image ??= find(block.spans); else if (block.kind === "table") for (const row of block.table.rows) for (const cell of row) image ??= find(cell.spans); }
    image ??= rendered.references.map(find).find(Boolean); if (image) mathImages.set(source, await pdfImage({ pdf } as PdfState, image));
  }
  const state: PdfState = { pdf, page: first, pages: [first], fonts, y: mla ? BODY_TOP_BASELINE : rendered.includeTitlePage ? 648 : BODY_TOP_BASELINE, rendered, professional: format.id === "apa-7-professional" || format.id === "ama-11", mla, mathImages };
  if (mla) {
    if (rendered.includeTitlePage) [...rendered.authors, rendered.instructor, rendered.course, rendered.dueDate].filter(Boolean).forEach((line) => drawText(state, line));
    drawText(state, rendered.title, { align: "center" });
  } else if (rendered.includeTitlePage) {
    drawText(state, rendered.title, { bold: true, align: "center" }); state.y -= LINE_HEIGHT;
    const metadata = format.id === "chicago-18" ? [...rendered.authors, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean) : format.id === "harvard-thesis" ? [...rendered.authors, `A Thesis in the Field of ${rendered.affiliations[0] ?? ""}`, "for the Degree of Master of Liberal Arts in Extension Studies", "Harvard University", rendered.dueDate].filter(Boolean) : format.id === "ama-11" ? [...rendered.authors, ...rendered.affiliations, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean) : state.professional ? [...rendered.authors, ...rendered.affiliations] : [...rendered.authors, ...rendered.affiliations, rendered.course, rendered.instructor, rendered.dueDate].filter(Boolean);
    metadata.forEach((line) => drawText(state, line, { align: "center" }));
    if (state.professional && rendered.authorNote) { state.y -= LINE_HEIGHT; drawText(state, "Author Note", { bold: true, align: "center" }); drawText(state, rendered.authorNote, { firstIndent: 36 }); }
  }
  if (!mla && rendered.abstract) {
    if (rendered.includeTitlePage) addPdfPage(state);
    drawText(state, "Abstract", { bold: true, align: "center" });
    rendered.abstract.split(/\r?\n/).filter(Boolean).forEach((line) => {
      const match = /^([^:]+):(.*)$/.exec(line);
      if (match) drawRich(state, [{ text: `${match[1]}:`, bold: true }, { text: match[2] }]);
      else drawText(state, line);
    });
    if (rendered.keywords.length) drawPdfKeywords(state, rendered.keywords);
  }
  if (!mla && (rendered.includeTitlePage || rendered.abstract)) addPdfPage(state);
  if (!mla && (!["chicago-18", "harvard-thesis"].includes(format.id) || !rendered.includeTitlePage)) drawText(state, rendered.title, { bold: true, align: "center" });
  for (const block of rendered.blocks) await drawPdfBlock(state, block);
  addPdfPage(state); drawText(state, referenceTitle(format, rendered), { bold: !plainReferenceHeading(format), align: "center" });
  rendered.references.forEach((reference) => drawRich(state, reference, { hanging: 36 }));
  for (const addendum of rendered.addenda) await drawPdfAddendum(state, addendum);
  drawPdfHeaders(state, ["chicago-18", "harvard-thesis", "harvard-author-date"].includes(format.id) && rendered.includeTitlePage);
  return Uint8Array.from(await pdf.save()).buffer;
}

async function toIeeePdf(rendered: RenderedDocument): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const fonts = await embedPdfFonts(pdf);
  const mathImages = new Map<string, PDFImage>();
  const prepareMath = async (spans: InlineSpan[]) => {
    for (const span of spans) if (span.math?.data && !mathImages.has(span.math.source)) mathImages.set(span.math.source, span.math.mimeType === "image/png" ? await pdf.embedPng(span.math.data) : await pdf.embedJpg(span.math.data));
  };
  for (const block of rendered.blocks) {
    if (block.kind === "heading" || block.kind === "paragraph") await prepareMath(block.spans);
    else if (block.kind === "table") for (const row of block.table.rows) for (const cell of row) await prepareMath(cell.spans);
  }
  for (const reference of rendered.references) await prepareMath(reference);
  let page = pdf.addPage([612, 792]);
  const margin = 54, gap = 18, columnWidth = (612 - margin * 2 - gap) / 2;
  let y = 738, column = 0;
  const fontFor = (span: InlineSpan, bold = false) => (bold || span.bold) && span.italic ? fonts.boldItalic : bold || span.bold ? fonts.bold : span.italic ? fonts.italic : span.code ? fonts.code : fonts.regular;
  const linesFor = (spans: InlineSpan[], width: number, size: number, bold = false): PdfToken[][] => {
    const items: PdfToken[] = [];
    spans.forEach((span) => { if (span.math) items.push({ text: "", font: fonts.regular, image: span.math }); else span.text.replace(/\s+/g, " ").split(/(\s+)/).filter(Boolean).forEach((text) => items.push({ text, font: supportedPdfFont(fontFor(span, bold), fonts.regular, text), strike: span.strike })); });
    const lines: PdfToken[][] = [[]]; let used = 0;
    for (const item of items) { const w = item.image ? size * 1.2 * ((item.image.width ?? size) / (item.image.height ?? size)) : item.font.widthOfTextAtSize(item.text, size); if (used + w > width && lines[lines.length - 1].some((token) => token.text.trim() || token.image)) { lines.push([]); used = 0; if (!item.text.trim() && !item.image) continue; } lines[lines.length - 1].push(item); used += w; }
    return lines;
  };
  const drawFull = (spans: InlineSpan[], size: number, options: { bold?: boolean; center?: boolean } = {}) => {
    for (const line of linesFor(spans, 504, size, options.bold)) { let x = margin; const width = line.reduce((sum, item) => sum + (item.image ? size * 1.2 * ((item.image.width ?? size) / (item.image.height ?? size)) : item.font.widthOfTextAtSize(item.text, size)), 0); if (options.center) x = (612 - width) / 2; for (const item of line) { const w = item.image ? size * 1.2 * ((item.image.width ?? size) / (item.image.height ?? size)) : item.font.widthOfTextAtSize(item.text, size); if (item.image) { const embedded = mathImages.get(item.image.source); if (embedded) page.drawImage(embedded, { x, y: y - 2, width: w, height: size * 1.2 }); } else page.drawText(item.text, { x, y, size, font: item.font }); x += w; } y -= size + 3; }
  };
  const nextColumn = () => { if (column === 0) { column = 1; y = 738; } else { page = pdf.addPage([612, 792]); column = 0; y = 738; } };
  const drawColumn = (spans: InlineSpan[], options: { bold?: boolean; center?: boolean; indent?: number; size?: number } = {}) => {
    const size = options.size ?? 10, indent = options.indent ?? 0;
    const lines = linesFor(spans, columnWidth - indent, size, options.bold);
    for (const [index, line] of lines.entries()) { if (y - 13 < margin) nextColumn(); let x = margin + column * (columnWidth + gap) + (index === 0 ? indent : 0); const width = line.reduce((sum, item) => sum + (item.image ? size * 1.2 * ((item.image.width ?? size) / (item.image.height ?? size)) : item.font.widthOfTextAtSize(item.text, size)), 0); if (options.center) x += (columnWidth - width) / 2; for (const item of line) { const w = item.image ? size * 1.2 * ((item.image.width ?? size) / (item.image.height ?? size)) : item.font.widthOfTextAtSize(item.text, size); if (item.image) { const embedded = mathImages.get(item.image.source); if (embedded) page.drawImage(embedded, { x, y: y - 2, width: w, height: size * 1.2 }); } else page.drawText(item.text, { x, y, size, font: item.font }); x += w; } y -= 12; }
  };
  drawFull([{ text: rendered.title }], 16, { center: true }); y -= 3;
  rendered.authors.forEach((author) => drawFull([{ text: author }], 11, { center: true }));
  rendered.affiliations.forEach((affiliation) => drawFull([{ text: affiliation }], 9, { center: true }));
  if (rendered.abstract) { y -= 6; drawFull([{ text: "Abstract—", bold: true }, { text: rendered.abstract }], 9); }
  if (rendered.keywords.length) drawFull([{ text: "Index Terms—", bold: true }, { text: rendered.keywords.join(", ") }], 9);
  y -= 8;
  for (const block of rendered.blocks) {
    if (block.kind === "heading") { y -= 4; drawColumn(block.spans, { bold: true, center: block.level === 1 }); }
    else if (block.kind === "paragraph") drawColumn(block.spans, { indent: 12 });
    else if (block.kind === "table") block.table.rows.forEach((row) => drawColumn([{ text: row.map((cell) => spansText(cell.spans)).join(" | ") }], { size: 8 }));
    else if (block.image.data && block.image.mimeType && block.image.width && block.image.height) {
      const image = block.image.mimeType === "image/png" ? await pdf.embedPng(block.image.data) : await pdf.embedJpg(block.image.data); const scale = Math.min(1, columnWidth / image.width, (y - margin) / image.height); if (y - image.height * scale < margin) nextColumn(); page.drawImage(image, { x: margin + column * (columnWidth + gap), y: y - image.height * scale, width: image.width * scale, height: image.height * scale }); y -= image.height * scale + 6;
    }
  }
  y -= 6; drawColumn([{ text: "REFERENCES" }], { bold: true, center: true });
  rendered.references.forEach((reference) => drawColumn(reference));
  return Uint8Array.from(await pdf.save()).buffer;
}

export async function exportArtifact(type: OutputType, rendered: RenderedDocument, format: DocumentFormat): Promise<ExportArtifact> {
  if (type === "pdf") return { extension: type, data: format.id === "ieee-conference" ? await toIeeePdf(rendered) : await toPdf(rendered, format) };
  if (type === "docx") return { extension: type, data: format.id === "ieee-conference" ? await toIeeeDocx(rendered, format) : await toDocx(rendered, format) };
  return { extension: type, data: encode(rendered.html) };
}
