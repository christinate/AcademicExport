import { Modal, Notice, Setting, type ButtonComponent } from "obsidian";
import type { App, TFile } from "obsidian";
import { OUTPUT_LABELS, OUTPUT_TYPES, type OutputType } from "./config";
import { BUILT_IN_FORMATS, exportVariantSelector, normalizeExportVariant } from "./formats";
import { missingFields, parseNote } from "./note";
import type { DocumentFormat, PluginSettings } from "./types";

export interface ExportSelection { format: DocumentFormat; variantId: string; outputTypes: OutputType[]; options: Record<string, boolean>; }

export class ExportModal extends Modal {
  private selectedFormatId: string;
  private selectedOutputs = new Set<OutputType>();
  private options: Record<string, boolean> = {};
  private selectedVariantId: string;
  constructor(app: App, private settings: PluginSettings, private file: TFile, private submit: (selection: ExportSelection) => Promise<void>) {
    super(app);
    const last = settings.lastExportSelection;
    this.selectedFormatId = (last && settings.formats[last.formatId]?.enabled ? last.formatId : undefined)
      ?? Object.entries(settings.formats).find(([, value]) => value.default && value.enabled)?.[0]
      ?? BUILT_IN_FORMATS.find((format) => settings.formats[format.id]?.enabled)?.id ?? BUILT_IN_FORMATS[0].id;
    const format = BUILT_IN_FORMATS.find((item) => item.id === this.selectedFormatId) ?? BUILT_IN_FORMATS[0];
    this.selectedVariantId = normalizeExportVariant(format, last?.formatId === this.selectedFormatId ? last.variantId : undefined);
    if (last && last.formatId === this.selectedFormatId) {
      this.options = { ...last.options };
      last.outputTypes.filter((type) => settings.formats[this.selectedFormatId].outputTypes[type]?.enabled).forEach((type) => this.selectedOutputs.add(type));
    } else this.selectDefaultOutputs(this.selectedFormatId);
  }
  private selectDefaultOutputs(formatId: string): void {
    this.selectedOutputs.clear();
    const preferences = this.settings.formats[formatId]?.outputTypes;
    for (const type of OUTPUT_TYPES) if (preferences?.[type].enabled && preferences[type].default) this.selectedOutputs.add(type);
  }
  async onOpen(): Promise<void> { await this.render(); }
  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("academic-export-modal");
    contentEl.createEl("h2", { text: "Export in…" });
    const format = BUILT_IN_FORMATS.find((item) => item.id === this.selectedFormatId) ?? BUILT_IN_FORMATS[0];
    this.options = { ...Object.fromEntries(format.options.map((option) => [option.key, option.default])), ...this.settings.formats[format.id]?.options, ...this.options };
    const note = parseNote(await this.app.vault.read(this.file));
    const missing = missingFields(note, format, this.options);
    if (missing.length) {
      const warning = contentEl.createDiv({ cls: "academic-export-warning" });
      warning.createEl("strong", { text: "Some information is missing from the template and the document may export improperly." });
      const list = warning.createEl("ul");
      missing.forEach((field) => list.createEl("li", { text: `${field} (${format.name})` }));
    }
    new Setting(contentEl).setName("Document style").addDropdown((dropdown) => {
      BUILT_IN_FORMATS.filter((item) => this.settings.formats[item.id]?.enabled).forEach((item) => { dropdown.addOption(item.id, item.name); });
      dropdown.setValue(format.id).onChange((value) => {
        this.selectedFormatId = value;
        const selectedFormat = BUILT_IN_FORMATS.find((item) => item.id === value) ?? BUILT_IN_FORMATS[0];
        this.selectedVariantId = normalizeExportVariant(selectedFormat);
        this.options = {};
        this.selectDefaultOutputs(value);
        void this.render();
      });
    });
    const variantSelector = this.settings.formats[format.id]?.enabled ? exportVariantSelector(format) : undefined;
    if (variantSelector) {
      new Setting(contentEl).setName(variantSelector.name).setDesc(variantSelector.description).addDropdown((dropdown) => {
        format.variants.forEach((variant) => { dropdown.addOption(variant.id, variant.name); });
        dropdown.setValue(this.selectedVariantId).onChange((value) => { this.selectedVariantId = normalizeExportVariant(format, value); });
      });
    }
    contentEl.createEl("h3", { text: "Output types" });
    for (const type of OUTPUT_TYPES) if (this.settings.formats[format.id].outputTypes[type].enabled) {
      new Setting(contentEl).setName(OUTPUT_LABELS[type]).addToggle((toggle) => toggle.setValue(this.selectedOutputs.has(type)).onChange((value) => value ? this.selectedOutputs.add(type) : this.selectedOutputs.delete(type)));
    }
    if (format.options.length) {
      contentEl.createEl("hr");
      contentEl.createEl("h3", { text: format.name });
      for (const option of format.options) new Setting(contentEl).setName(option.label).setDesc(option.description).addToggle((toggle) => toggle.setValue(this.options[option.key] ?? option.default).onChange((value) => { this.options[option.key] = value; }));
    }
    new Setting(contentEl).addButton((button: ButtonComponent) => button.setButtonText("Export").setCta().onClick(async () => {
      if (!this.selectedOutputs.size) { new Notice("Select at least one output type."); return; }
      button.setDisabled(true);
      await this.submit({ format, variantId: this.selectedVariantId, outputTypes: [...this.selectedOutputs], options: this.options });
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class FormatPickerModal extends Modal {
  constructor(app: App, private title: string, private settings: PluginSettings, private select: (format: DocumentFormat) => void) { super(app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: this.title });
    for (const format of BUILT_IN_FORMATS.filter((item) => this.settings.formats[item.id]?.enabled)) {
      new Setting(this.contentEl).setName(format.name).setDesc(format.description).addButton((button) => button.setButtonText("Select").onClick(() => { this.close(); this.select(format); }));
    }
  }
  onClose(): void { this.contentEl.empty(); }
}

export class PaperTypePickerModal extends Modal {
  constructor(app: App, private format: DocumentFormat, private select: (variantId: string) => void) { super(app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: `${this.format.name} paper type` });
    for (const variant of this.format.variants) {
      new Setting(this.contentEl).setName(variant.name).setDesc(variant.description).addButton((button) => button.setButtonText("Select").onClick(() => { this.close(); this.select(variant.id); }));
    }
  }
  onClose(): void { this.contentEl.empty(); }
}

export class ConfirmReplaceModal extends Modal {
  constructor(app: App, private format: DocumentFormat, private confirm: () => Promise<void>) { super(app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Replace with template" });
    this.contentEl.createEl("p", { text: `Are you sure you want to replace the content of this note with the ${this.format.name} template?` });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("No").onClick(() => this.close()))
      .addButton((button) => button.setButtonText("Yes, replace").setDestructive().onClick(async () => { await this.confirm(); this.close(); }));
  }
  onClose(): void { this.contentEl.empty(); }
}
