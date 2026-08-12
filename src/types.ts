import type { OutputType } from "./config";

export type FieldType = "string" | "date" | "string-list" | "markdown";
export interface FormatField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  description: string;
  aliases?: string[];
}
export interface FormatOption {
  key: string;
  label: string;
  description: string;
  default: boolean;
}
export interface PageRules {
  size: "letter";
  marginInches: number;
  fontFamily: string;
  fontSizePoints: number;
  lineSpacing: number;
  paragraphIndentInches: number;
  pageNumbers: boolean;
  runningHead: boolean;
}
export interface DocumentFormat {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  templateFile: string;
  fields: FormatField[];
  options: FormatOption[];
  rules: PageRules;
  sections: { key: string; label: string; required: boolean; pageBreakBefore?: boolean }[];
  variants: PaperVariant[];
}
export interface PaperVariant {
  id: string;
  name: string;
  description: string;
  recommendedSections: string[];
  abstractDefault: boolean;
}
export interface OutputPreference { enabled: boolean; default: boolean; }
export interface FormatPreference {
  enabled: boolean;
  default: boolean;
  outputTypes: Record<OutputType, OutputPreference>;
  options: Record<string, boolean>;
}
export interface PluginSettings {
  formats: Record<string, FormatPreference>;
  autoDefaultExporting: boolean;
  defaultSaveLocation: string;
  defaultAuthor: string;
  defaultAffiliation: string;
  showPageCounter: boolean;
  pageCounterFormat: string;
  createBackups: boolean;
  lastExportSelection: LastExportSelection | null;
}
export interface LastExportSelection {
  formatId: string;
  variantId: string;
  outputTypes: OutputType[];
  options: Record<string, boolean>;
}
export interface ParsedNote { frontmatter: Record<string, unknown>; body: string; }
export interface ExportRequest { format: DocumentFormat; variantId: string; outputTypes: OutputType[]; options: Record<string, boolean>; }
