import { getFrontMatterInfo, parseYaml } from "obsidian";
import type { DocumentFormat, ParsedNote } from "./types";

export function parseNote(source: string): ParsedNote {
  const info = getFrontMatterInfo(source);
  if (!info.exists) return { frontmatter: {}, body: source };
  const yaml = source.slice(info.from, info.to).replace(/^---\s*\r?\n/, "").replace(/\r?\n---\s*$/, "");
  return { frontmatter: (parseYaml(yaml) as Record<string, unknown> | null) ?? {}, body: source.slice(info.contentStart) };
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(hasValue);
  return typeof value !== "string" || value.trim().length > 0;
}

export function fieldValue(note: ParsedNote, key: string, aliases: string[] = []): unknown {
  for (const candidate of [key, ...aliases]) {
    const exact = Object.keys(note.frontmatter).find((entry) => entry.toLowerCase() === candidate.toLowerCase());
    if (exact !== undefined) return note.frontmatter[exact];
  }
  if (key === "Body") return note.body;
  return undefined;
}

export function missingFields(note: ParsedNote, format: DocumentFormat, options: Record<string, boolean>): string[] {
  return format.fields
    .filter((field) => {
      if (!field.required) return false;
      if (field.key === "Abstract" && options.includeAbstract === false) return false;
      if (field.key === "AuthorNote" && options.includeAuthorNote === false) return false;
      if (field.key === "References") return fieldValue(note, field.key, field.aliases) === undefined;
      return !hasValue(fieldValue(note, field.key, field.aliases));
    })
    .map((field) => field.label);
}

export function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringifyValue).join(", ");
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return JSON.stringify(value);
}
