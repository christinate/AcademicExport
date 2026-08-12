import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";

export interface RenderedMathImage {
  data: ArrayBuffer;
  mimeType: "image/png";
  width: number;
  height: number;
}

type SvgConverter = (source: string, display: boolean) => string;
let converterPromise: Promise<SvgConverter> | undefined;

function mathConverter(): Promise<SvgConverter> {
  converterPromise ??= (async () => {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] = await Promise.all([
      import("mathjax-full/js/mathjax.js"),
      import("mathjax-full/js/input/tex.js"),
      import("mathjax-full/js/output/svg.js"),
      import("mathjax-full/js/adaptors/liteAdaptor.js"),
      import("mathjax-full/js/handlers/html.js")
    ]);
    await Promise.all([
      import("mathjax-full/js/input/tex/ams/AmsConfiguration.js"),
      import("mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js"),
      import("mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js")
    ]);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const mathDocument = mathjax.document("", {
      InputJax: new TeX({ packages: ["base", "ams", "newcommand", "noundefined"] }),
      OutputJax: new SVG({ fontCache: "none" })
    });
    return (source: string, display: boolean) => {
      const converted: unknown = mathDocument.convert(source, { display });
      return adaptor.outerHTML(converted as LiteElement);
    };
  })();
  return converterPromise;
}

export async function renderMath(source: string, display: boolean): Promise<RenderedMathImage> {
  let markup: string;
  try {
    markup = (await mathConverter())(source, display);
  } catch (error) {
    throw new Error(`Could not render math “${source}”: ${error instanceof Error ? error.message : String(error)}`);
  }
  const svgStart = markup.indexOf("<svg"), svgEnd = markup.lastIndexOf("</svg>");
  if (svgStart < 0 || svgEnd < 0) throw new Error(`The bundled math renderer returned no image for: ${source}`);
  let svg = markup.slice(svgStart, svgEnd + 6).replace(/currentColor/g, "#000000");
  const viewBox = /viewBox="[^ ]+ [^ ]+ ([^ ]+) ([^"]+)"/.exec(svg);
  const ratio = viewBox ? Number(viewBox[1]) / Number(viewBox[2]) : Math.max(1, source.length / 4);
  const exWidth = Number(/\bwidth="([\d.]+)ex"/.exec(svg)?.[1]);
  const exHeight = Number(/\bheight="([\d.]+)ex"/.exec(svg)?.[1]);
  const pixelsPerEx = 8, rasterScale = 2;
  const logicalHeight = Number.isFinite(exHeight) ? exHeight * pixelsPerEx : (display ? 24 : 16);
  const logicalWidth = Number.isFinite(exWidth) ? exWidth * pixelsPerEx : logicalHeight * ratio;
  const width = Math.max(8, Math.min(3600, Math.ceil(logicalWidth * rasterScale)));
  const height = Math.max(8, Math.min(2400, Math.ceil(logicalHeight * rasterScale)));
  svg = svg.replace(/\bwidth="[^"]+"/, `width="${width}px"`).replace(/\bheight="[^"]+"/, `height="${height}px"`);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Rendered math image could not be loaded: ${source}`)); image.src = url; });
    const canvas = createEl("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Math rendering is unavailable in this Obsidian window.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (pixels[offset + 3] > 0 && (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245)) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) throw new Error(`The bundled math renderer produced an empty image: ${source}`);
    const padding = 4;
    left = Math.max(0, left - padding); top = Math.max(0, top - padding);
    right = Math.min(canvas.width - 1, right + padding); bottom = Math.min(canvas.height - 1, bottom + padding);
    const cropped = createEl("canvas"); cropped.width = right - left + 1; cropped.height = bottom - top + 1;
    const croppedContext = cropped.getContext("2d"); if (!croppedContext) throw new Error("Math cropping is unavailable in this Obsidian window.");
    croppedContext.fillStyle = "#ffffff"; croppedContext.fillRect(0, 0, cropped.width, cropped.height);
    croppedContext.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    const blob = await new Promise<Blob>((resolve, reject) => cropped.toBlob((value) => value ? resolve(value) : reject(new Error("Math PNG creation failed.")), "image/png"));
    return { data: await blob.arrayBuffer(), mimeType: "image/png", width: cropped.width / rasterScale, height: cropped.height / rasterScale };
  } finally { URL.revokeObjectURL(url); }
}
