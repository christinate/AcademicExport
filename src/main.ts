import { MarkdownView, Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import type { Menu, TAbstractFile } from "obsidian";
import { safeFilename, saveArtifacts } from "./destination";
import { FORMAT_BY_ID } from "./formats";
import { ConfirmReplaceModal, ExportModal, FormatPickerModal, PaperTypePickerModal, type ExportSelection } from "./modals";
import { missingFields, parseNote } from "./note";
import { renderDocument } from "./render";
import { DEFAULT_SETTINGS, mergeSettings } from "./settings";
import { ExportSettingTab } from "./settings-tab";
import { BUNDLED_TEMPLATES } from "./templates";
import type { DocumentFormat, PluginSettings } from "./types";

export default class AcademicExportPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private pageCounterEl: HTMLElement | null = null;
  private pageCounterTimer: number | null = null;
  private pageCounterGeneration = 0;
  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData() as Partial<PluginSettings> | null);
    this.addSettingTab(new ExportSettingTab(this));
    this.addCommand({ id: "export-in", name: "Export in…", checkCallback: (checking) => { const file = this.app.workspace.getActiveFile(); if (!file) return false; if (!checking) void this.startExport(file); return true; } });
    this.pageCounterEl = this.addStatusBarItem();
    this.pageCounterEl.addClass("academic-export-page-counter");
    this.pageCounterEl.addClass("mod-clickable");
    this.pageCounterEl.setAttribute("aria-label", "Open export page-counter settings");
    this.pageCounterEl.addEventListener("click", () => new Notice("Change the page-counter format in this plugin's settings."));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refreshPageCounter()));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshPageCounter()));
    this.app.workspace.onLayoutReady(() => {
      // Register after Obsidian's core menu handlers so this item follows the
      // built-in Export to PDF entry in their shared action section.
      this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => this.addFileMenuItems(menu, file)));
      this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu) => { const file = this.app.workspace.getActiveFile(); if (file) this.addExportItem(menu, file); }));
      this.refreshPageCounter();
    });
  }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  refreshPageCounter(): void {
    if (!this.pageCounterEl) return;
    this.pageCounterEl.toggleClass("is-hidden", !this.settings.showPageCounter);
    if (!this.settings.showPageCounter) return;
    if (this.pageCounterTimer !== null) window.clearTimeout(this.pageCounterTimer);
    const generation = ++this.pageCounterGeneration;
    this.pageCounterEl.setText("Pages: calculating…");
    this.pageCounterTimer = window.setTimeout(() => void this.calculatePageCount(generation), 1200);
  }
  private async calculatePageCount(generation: number): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const format = FORMAT_BY_ID.get(this.settings.pageCounterFormat);
    if (!file || file.extension !== "md" || !format || !this.pageCounterEl) { if (generation === this.pageCounterGeneration) this.pageCounterEl?.setText("Pages: —"); return; }
    try {
      const source = view?.file?.path === file.path ? view.editor.getValue() : await this.app.vault.read(file);
      const preference = this.settings.formats[format.id];
      const rendered = renderDocument(parseNote(source), format, preference.defaultVariant, preference.options);
      const [{ resolveDocumentImages }, { exportArtifact }, { PDFDocument }] = await Promise.all([import("./assets"), import("./exporters"), import("pdf-lib")]);
      await resolveDocumentImages(this.app, file, rendered);
      const artifact = await exportArtifact("pdf", rendered, format);
      const pages = (await PDFDocument.load(artifact.data)).getPageCount();
      if (generation === this.pageCounterGeneration) this.pageCounterEl.setText(`${format.name}: ${pages} ${pages === 1 ? "page" : "pages"}`);
    } catch (error) {
      console.warn("Academic Export page counter failed", error);
      if (generation === this.pageCounterGeneration) this.pageCounterEl.setText("Pages: unavailable");
    }
  }
  private addExportItem(menu: Menu, file: TFile): void { menu.addItem((item) => item.setTitle("Export in…").setIcon("download").setSection("action").onClick(() => void this.startExport(file))); }
  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (file instanceof TFile && file.extension === "md") {
      this.addExportItem(menu, file);
      menu.addItem((item) => item.setTitle("Replace with template").setIcon("file-input").onClick(() => this.chooseReplacement(file)));
    } else if (file instanceof TFolder) menu.addItem((item) => item.setTitle("New export template").setIcon("file-plus").onClick(() => this.chooseNewTemplate(file)));
  }
  private defaultSelection(): ExportSelection | null {
    const formatId = Object.entries(this.settings.formats).find(([, value]) => value.enabled && value.default)?.[0];
    const format = formatId ? FORMAT_BY_ID.get(formatId) : undefined;
    const outputTypes = format ? Object.entries(this.settings.formats[format.id].outputTypes).filter(([, value]) => value.enabled && value.default).map(([key]) => key) as ExportSelection["outputTypes"] : [];
    return format && outputTypes.length ? { format, variantId: this.settings.formats[format.id].defaultVariant, outputTypes, options: this.settings.formats[format.id].options } : null;
  }
  async startExport(file: TFile): Promise<void> {
    const selection = this.defaultSelection();
    if (this.settings.autoDefaultExporting && selection) {
      const parsed = parseNote(await this.app.vault.read(file));
      if (!missingFields(parsed, selection.format, selection.options).length) { await this.performExport(file, selection); return; }
    }
    new ExportModal(this.app, this.settings, file, async (chosen) => {
      this.settings.lastExportSelection = { formatId: chosen.format.id, variantId: chosen.variantId, outputTypes: [...chosen.outputTypes], options: { ...chosen.options } };
      await this.saveSettings();
      await this.performExport(file, chosen);
    }).open();
  }
  private async performExport(file: TFile, selection: ExportSelection): Promise<void> {
    try {
      const parsed = parseNote(await this.app.vault.read(file));
      const rendered = renderDocument(parsed, selection.format, selection.variantId, selection.options);
      const [{ resolveDocumentImages }, { exportArtifact }] = await Promise.all([import("./assets"), import("./exporters")]);
      await resolveDocumentImages(this.app, file, rendered);
      const artifacts = await Promise.all(selection.outputTypes.map((type) => exportArtifact(type, rendered, selection.format)));
      const paths = await saveArtifacts(this.app, this.settings.defaultSaveLocation, safeFilename(rendered.title), artifacts);
      new Notice(paths.length ? `Exported ${paths.length} file${paths.length === 1 ? "" : "s"}.` : "Export canceled; no files were written.");
    } catch (error) { console.error("Academic Export failed", error); new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  private chooseNewTemplate(folder: TFolder): void { new FormatPickerModal(this.app, "New export template", this.settings, (format) => new PaperTypePickerModal(this.app, format, this.settings.formats[format.id].defaultVariant, (variantId) => void this.createFromTemplate(folder, format, variantId)).open()).open(); }
  private async createFromTemplate(folder: TFolder, format: DocumentFormat, variantId: string): Promise<void> {
    const template = this.prefillTemplate(this.applyVariantTemplate(this.readTemplate(format), format, variantId));
    const variant = format.variants.find((item) => item.id === variantId) ?? format.variants[0];
    let path = normalizePath(`${folder.path}/${variant.name}.md`); let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${folder.path}/${variant.name} ${counter++}.md`);
    const file = await this.app.vault.create(path, template); await this.app.workspace.getLeaf(true).openFile(file);
  }
  private chooseReplacement(file: TFile): void { new FormatPickerModal(this.app, "Replace with template", this.settings, (format) => new PaperTypePickerModal(this.app, format, this.settings.formats[format.id].defaultVariant, (variantId) => new ConfirmReplaceModal(this.app, format, () => this.replaceWithTemplate(file, format, variantId)).open()).open()).open(); }
  private async replaceWithTemplate(file: TFile, format: DocumentFormat, variantId: string): Promise<void> {
    const original = await this.app.vault.read(file);
    if (this.settings.createBackups) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await this.app.vault.create(normalizePath(`${file.parent?.path ?? ""}/${file.basename}.${stamp}.backup.md`), original);
    }
    const replacement = this.applyVariantTemplate(this.readTemplate(format), format, variantId);
    await this.app.vault.process(file, () => replacement); new Notice(`Replaced with ${format.name} template.`);
  }
  private applyVariantTemplate(template: string, format: DocumentFormat, variantId: string): string {
    const variant = format.variants.find((item) => item.id === variantId) ?? format.variants[0];
    const sections = variant.recommendedSections.filter((section) => !/^(abstract|references)$/i.test(section));
    if (!sections.length) return template;
    const outline = sections.map((section) => `## ${section}\n\nWrite this section here.`).join("\n\n");
    return template.replace(/## First Main Section\s*\r?\n\s*Write the section here\./, outline);
  }
  private prefillTemplate(template: string): string {
    const yamlQuote = (value: string): string => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    let result = template;
    if (this.settings.defaultAuthor) result = result.replace(/^(Author:\s*\r?\n)\s*-\s*[^\r\n]+/m, `$1  - ${yamlQuote(this.settings.defaultAuthor)}`);
    if (this.settings.defaultAffiliation) result = result.replace(/^Affiliation:\s*[^\r\n]*$/m, `Affiliation: ${yamlQuote(this.settings.defaultAffiliation)}`);
    return result;
  }
  private readTemplate(format: DocumentFormat): string {
    const bundled = BUNDLED_TEMPLATES[format.templateFile];
    if (bundled !== undefined) return bundled;
    throw new Error(`Template not found: ${format.templateFile}`);
  }
}
