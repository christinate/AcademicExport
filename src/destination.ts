import { FileSystemAdapter, normalizePath, Platform, TFile, type App } from "obsidian";
import type { ExportArtifact } from "./exporters";

export function safeFilename(value: string): string {
  const printable = [...value].map((character) => character.charCodeAt(0) < 32 ? "-" : character).join("");
  return printable.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/, "").trim() || "Untitled";
}

async function writeVault(app: App, folder: string, baseName: string, artifacts: ExportArtifact[]): Promise<string[]> {
  const normalized = normalizePath(folder || "Exports");
  if (!app.vault.getAbstractFileByPath(normalized)) await app.vault.createFolder(normalized);
  const paths: string[] = [];
  for (const artifact of artifacts) {
    const path = normalizePath(`${normalized}/${baseName}.${artifact.extension}`);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await app.vault.modifyBinary(existing, artifact.data);
    else if (existing) throw new Error(`Export path is occupied by a folder: ${path}`);
    else await app.vault.createBinary(path, artifact.data);
    paths.push(path);
  }
  return paths;
}

interface DesktopChoice { available: boolean; filePath?: string; }

async function chooseDesktopPath(defaultPath: string, extension: string): Promise<DesktopChoice> {
  try {
    const electron = window.require?.("electron") as { remote?: { dialog: { showSaveDialog: (options: object) => Promise<{ canceled: boolean; filePath?: string }> } } } | undefined;
    const dialog = electron?.remote?.dialog;
    if (!dialog) return { available: false };
    const result = await dialog.showSaveDialog({ defaultPath, filters: [{ name: `${extension.toUpperCase()} file`, extensions: [extension] }] });
    return result.canceled ? { available: true } : { available: true, filePath: result.filePath };
  } catch { return { available: false }; }
}

export async function saveArtifacts(app: App, folder: string, baseName: string, artifacts: ExportArtifact[]): Promise<string[]> {
  if (Platform.isDesktopApp && app.vault.adapter instanceof FileSystemAdapter) {
    const fullDefault = `${app.vault.adapter.getBasePath()}/${folder}/${baseName}`;
    const fs = window.require?.("fs") as { promises: { mkdir(path: string, options: { recursive: boolean }): Promise<void>; writeFile(path: string, data: Uint8Array): Promise<void> } };
    const path = window.require?.("path") as { dirname(path: string): string };
    const results: string[] = [];
    for (const artifact of artifacts) {
      // Ask separately so replacing a PDF never silently authorizes replacing
      // a DOCX or HTML file with the same stem.
      const chosen = await chooseDesktopPath(`${fullDefault}.${artifact.extension}`, artifact.extension);
      if (!chosen.available) return results.length ? results : writeVault(app, folder, baseName, artifacts);
      if (!chosen.filePath) continue;
      await fs.promises.mkdir(path.dirname(chosen.filePath), { recursive: true });
      await fs.promises.writeFile(chosen.filePath, new Uint8Array(artifact.data));
      results.push(chosen.filePath);
    }
    return results;
  }
  return writeVault(app, folder, baseName, artifacts);
}
