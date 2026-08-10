import { finishRenderMath, renderMath as renderObsidianMath, type App, type TFile } from "obsidian";
import type { ContentBlock, EmbeddedImage, RenderedDocument } from "./render";

const MIME_BY_EXTENSION: Record<string, EmbeddedImage["mimeType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp"
};

interface CanvasNode { id: string; type: string; x: number; y: number; width: number; height: number; text?: string; file?: string; url?: string; label?: string; color?: string; }
interface CanvasEdge { fromNode: string; toNode: string; label?: string; }
interface CanvasData { nodes?: CanvasNode[]; edges?: CanvasEdge[]; }

function canvasColor(value?: string): string {
  return ({ "1": "#e05252", "2": "#e09952", "3": "#d6c84b", "4": "#4fa66d", "5": "#4f83cc", "6": "#8a63c7" } as Record<string, string>)[value ?? ""] ?? "#59636f";
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > width) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

async function renderCanvas(data: string): Promise<{ data: ArrayBuffer; mimeType: "image/png"; width: number; height: number }> {
  const parsed = JSON.parse(data) as CanvasData;
  const nodes = parsed.nodes ?? [];
  if (!nodes.length) throw new Error("The embedded canvas has no nodes to render.");
  const padding = 48;
  const minX = Math.min(...nodes.map((node) => node.x)), minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width)), maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const naturalWidth = maxX - minX + padding * 2, naturalHeight = maxY - minY + padding * 2;
  const scale = Math.min(2, 2000 / naturalWidth, 2000 / naturalHeight);
  const width = Math.max(1, Math.round(naturalWidth * scale)), height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = createEl("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this Obsidian window.");
  context.scale(scale, scale); context.fillStyle = "#ffffff"; context.fillRect(0, 0, naturalWidth, naturalHeight);
  context.translate(padding - minX, padding - minY);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  context.strokeStyle = "#7b8490"; context.fillStyle = "#7b8490"; context.lineWidth = 2;
  for (const edge of parsed.edges ?? []) {
    const from = byId.get(edge.fromNode), to = byId.get(edge.toNode); if (!from || !to) continue;
    const x1 = from.x + from.width / 2, y1 = from.y + from.height / 2, x2 = to.x + to.width / 2, y2 = to.y + to.height / 2;
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1); context.beginPath(); context.moveTo(x2, y2); context.lineTo(x2 - 12 * Math.cos(angle - 0.45), y2 - 12 * Math.sin(angle - 0.45)); context.lineTo(x2 - 12 * Math.cos(angle + 0.45), y2 - 12 * Math.sin(angle + 0.45)); context.closePath(); context.fill();
  }
  for (const node of nodes) {
    context.fillStyle = node.type === "group" ? "#f5f6f8" : "#ffffff"; context.strokeStyle = canvasColor(node.color); context.lineWidth = node.type === "group" ? 2 : 3;
    context.beginPath(); context.roundRect(node.x, node.y, node.width, node.height, 10); context.fill(); context.stroke();
    const content = node.text ?? node.label ?? node.file ?? node.url ?? (node.type === "group" ? "Group" : "");
    context.save(); context.beginPath(); context.rect(node.x + 10, node.y + 10, node.width - 20, node.height - 20); context.clip();
    context.fillStyle = "#1f2328"; context.font = "16px Arial"; context.textBaseline = "top";
    wrappedLines(context, content, node.width - 28).forEach((line, index) => context.fillText(line, node.x + 14, node.y + 14 + index * 21)); context.restore();
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Canvas PNG creation failed.")), "image/png"));
  return { data: await blob.arrayBuffer(), mimeType: "image/png", width, height };
}

function imagesInBlocks(blocks: ContentBlock[]): EmbeddedImage[] {
  const images: EmbeddedImage[] = [];
  for (const block of blocks) {
    if (block.kind === "image") images.push(block.image);
    if (block.kind === "heading" || block.kind === "paragraph") block.spans.forEach((span) => { if (span.math) images.push(span.math); });
    if (block.kind === "table") block.table.rows.forEach((row) => row.forEach((cell) => { images.push(...cell.images); cell.spans.forEach((span) => { if (span.math) images.push(span.math); }); }));
  }
  return images;
}

async function renderMath(source: string, display: boolean): Promise<{ data: ArrayBuffer; mimeType: "image/png"; width: number; height: number }> {
  const rendered = renderObsidianMath(source, display);
  await finishRenderMath();
  const markup = rendered.outerHTML;
  const svgStart = markup.indexOf("<svg"), svgEnd = markup.lastIndexOf("</svg>");
  if (svgStart < 0 || svgEnd < 0) throw new Error(`MathJax could not render: ${source}`);
  const svg = markup.slice(svgStart, svgEnd + 6).replace(/currentColor/g, "#000000");
  const viewBox = /viewBox="[^ ]+ [^ ]+ ([^ ]+) ([^"]+)"/.exec(svg);
  const ratio = viewBox ? Number(viewBox[1]) / Number(viewBox[2]) : Math.max(1, source.length / 4);
  const height = display ? 96 : 40, width = Math.max(8, Math.min(1800, Math.round(height * ratio)));
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Rendered math image could not be loaded: ${source}`)); image.src = url; });
    const canvas = createEl("canvas"); canvas.width = width * 2; canvas.height = height * 2;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Math rendering is unavailable in this Obsidian window.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Math PNG creation failed.")), "image/png"));
    return { data: await blob.arrayBuffer(), mimeType: "image/png", width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

async function dimensions(data: ArrayBuffer, mimeType: NonNullable<EmbeddedImage["mimeType"]>): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([data], { type: mimeType }));
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

export async function resolveDocumentImages(app: App, sourceFile: TFile, document: RenderedDocument): Promise<void> {
  const images = [...imagesInBlocks(document.blocks), ...document.addenda.flatMap((page) => imagesInBlocks(page.blocks))];
  document.references.forEach((reference) => reference.forEach((span) => { if (span.math) images.push(span.math); }));
  const cache = new Map<string, Omit<EmbeddedImage, "source" | "alt">>();
  for (const image of images) {
    let resolved = cache.get(image.source);
    if (!resolved) {
      if (image.source.startsWith("math-inline:") || image.source.startsWith("math-display:")) {
        const display = image.source.startsWith("math-display:");
        resolved = await renderMath(decodeURIComponent(image.source.slice(image.source.indexOf(":") + 1)), display);
        cache.set(image.source, resolved); Object.assign(image, resolved); continue;
      }
      const file = app.metadataCache.getFirstLinkpathDest(image.source, sourceFile.path);
      if (!file) throw new Error(`Embedded image not found in the vault: ${image.source}`);
      if (file.extension.toLowerCase() === "canvas") resolved = await renderCanvas(await app.vault.read(file));
      else {
        const mimeType = MIME_BY_EXTENSION[file.extension.toLowerCase()];
        if (!mimeType) throw new Error(`Unsupported embedded image type .${file.extension}: ${image.source}`);
        const data = await app.vault.readBinary(file);
        const size = await dimensions(data, mimeType);
        resolved = { data, mimeType, ...size };
      }
      cache.set(image.source, resolved);
    }
    Object.assign(image, resolved);
  }
}
