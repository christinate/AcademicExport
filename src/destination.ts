import { FileSystemAdapter, normalizePath, Platform, TFile, type App } from "obsidian";
import type { ExportArtifact } from "./exporters";

export function safeFilename(value: string): string {
  const printable = [...value].map((character) => character.charCodeAt(0) < 32 ? "-" : character).join("");
  return printable.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/, "").trim() || "Untitled";
}

async function writeVault(app: App, folder: string, baseName: string, artifacts: ExportArtifact[]): Promise<string[]> {
  const portableFolder = folder.replace(/\\/g, "/");
  const normalized = /^[A-Za-z]:\//.test(portableFolder) || portableFolder.startsWith("/")
    ? "Exports"
    : normalizePath(folder || "Exports");
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
export interface DesktopFolderChoice { available: boolean; folderPath?: string; }

interface DesktopDialog {
  showOpenDialog(options: object): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(options: object): Promise<{ canceled: boolean; filePath?: string }>;
}

interface DesktopPath {
  dirname(path: string): string;
  isAbsolute(path: string): boolean;
  join(...paths: string[]): string;
}

function getDesktopDialog(): DesktopDialog | undefined {
  const electron = window.require?.("electron") as { remote?: { dialog: DesktopDialog } } | undefined;
  return electron?.remote?.dialog;
}

function getDesktopPath(): DesktopPath | undefined {
  return window.require?.("path") as DesktopPath | undefined;
}

function resolveDesktopFolder(app: App, folder: string, path: DesktopPath): string | null {
  if (!(app.vault.adapter instanceof FileSystemAdapter)) return null;
  if (folder && path.isAbsolute(folder)) return folder;
  return path.join(app.vault.adapter.getBasePath(), folder || "Exports");
}

export async function chooseDesktopFolder(app: App, currentFolder: string): Promise<DesktopFolderChoice> {
  if (!Platform.isDesktopApp) return { available: false };
  try {
    const dialog = getDesktopDialog();
    const path = getDesktopPath();
    if (!dialog || !path) return { available: false };
    const defaultPath = resolveDesktopFolder(app, currentFolder, path);
    if (!defaultPath) return { available: false };
    const result = await dialog.showOpenDialog({
      title: "Choose default save folder",
      buttonLabel: "Select folder",
      defaultPath,
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? { available: true } : { available: true, folderPath: result.filePaths[0] };
  } catch {
    return { available: false };
  }
}

async function chooseDesktopPath(defaultPath: string, extension: string): Promise<DesktopChoice> {
  try {
    const dialog = getDesktopDialog();
    if (!dialog) return { available: false };
    const result = await dialog.showSaveDialog({ defaultPath, filters: [{ name: `${extension.toUpperCase()} file`, extensions: [extension] }] });
    return result.canceled ? { available: true } : { available: true, filePath: result.filePath };
  } catch { return { available: false }; }
}

export async function saveArtifacts(app: App, folder: string, baseName: string, artifacts: ExportArtifact[]): Promise<string[]> {
  if (Platform.isDesktopApp && app.vault.adapter instanceof FileSystemAdapter) {
    const path = getDesktopPath();
    if (!path) return writeVault(app, folder, baseName, artifacts);
    const configuredFolder = resolveDesktopFolder(app, folder, path);
    if (!configuredFolder) return writeVault(app, folder, baseName, artifacts);
    const fullDefault = path.join(configuredFolder, baseName);
    const fs = window.require?.("fs") as { promises: { mkdir(path: string, options: { recursive: boolean }): Promise<void>; writeFile(path: string, data: Uint8Array): Promise<void> } };
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
