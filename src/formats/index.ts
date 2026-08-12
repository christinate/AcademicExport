import student from "./apa-7-student.json";
import professional from "./apa-7-professional.json";
import mla from "./mla-9.json";
import chicago from "./chicago-18.json";
import ieee from "./ieee-conference.json";
import harvardThesis from "./harvard-thesis.json";
import harvardAuthorDate from "./harvard-author-date.json";
import ama from "./ama-11.json";
import type { DocumentFormat } from "../types";

export const BUILT_IN_FORMATS = [student, professional, mla, chicago, ieee, harvardThesis, harvardAuthorDate, ama] as DocumentFormat[];
export const FORMAT_BY_ID = new Map(BUILT_IN_FORMATS.map((format) => [format.id, format]));

export interface ExportVariantSelector {
  name: string;
  description: string;
}

const EXPORT_VARIANT_SELECTORS: Record<string, ExportVariantSelector> = {
  "chicago-18": {
    name: "Citation system",
    description: "Choose Notes and Bibliography or Author-Date."
  },
  "ama-11": {
    name: "Abstract type",
    description: "Choose a structured or unstructured abstract."
  }
};

export function exportVariantSelector(format: DocumentFormat): ExportVariantSelector | undefined {
  return EXPORT_VARIANT_SELECTORS[format.id];
}

export function normalizeExportVariant(format: DocumentFormat, requested?: string): string {
  const selectable = exportVariantSelector(format) !== undefined;
  if (selectable && requested && format.variants.some((variant) => variant.id === requested)) return requested;
  return format.variants[0].id;
}
