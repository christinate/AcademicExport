import { PluginSettingTab, Setting, normalizePath } from "obsidian";
import { OUTPUT_LABELS, OUTPUT_TYPES, PROJECT } from "./config";
import { BUILT_IN_FORMATS } from "./formats";
import type AcademicExportPlugin from "./main";

export class ExportSettingTab extends PluginSettingTab {
  constructor(private plugin: AcademicExportPlugin) { super(plugin.app, plugin); }
  display(): void { this.renderSettings(); }
  private renderSettings(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", { text: "Choose which document styles and output types appear in the export dialog." });
    for (const format of BUILT_IN_FORMATS) {
      const state = this.plugin.settings.formats[format.id];
      new Setting(containerEl).setName(format.name).setHeading().settingEl.addClass("academic-export-section-heading");
      const group = containerEl.createDiv({ cls: "academic-export-settings-card" });
      const columns = group.createDiv({ cls: "academic-export-column-heading" });
      columns.createSpan();
      columns.createSpan({ text: "Available", cls: "academic-export-column-label" });
      const includeSetting = new Setting(group).setName("Include in list").setDesc(format.description)
        .addToggle((toggle) => toggle.setTooltip("Show in format selectors").setValue(state.enabled).onChange((enabled) => { state.enabled = enabled; void this.plugin.saveSettings().then(() => this.renderSettings()); }));
      includeSetting.settingEl.addClass("academic-export-available-setting");
      for (const type of OUTPUT_TYPES) {
        const output = state.outputTypes[type];
        const outputSetting = new Setting(group).setName(OUTPUT_LABELS[type])
          .addToggle((toggle) => toggle.setTooltip(`Offer ${OUTPUT_LABELS[type]} for ${format.name}`).setValue(output.enabled).onChange((enabled) => { output.enabled = enabled; void this.plugin.saveSettings().then(() => this.renderSettings()); }));
        outputSetting.settingEl.addClass("academic-export-available-setting");
      }
      if (format.options.length) {
        const optionTitle = format.id === "apa-7-student" ? "APA Student 7 format" : format.id === "apa-7-professional" ? "APA Professional 7 format" : `${format.name} format`;
        new Setting(containerEl).setName(optionTitle).setHeading().settingEl.addClass("academic-export-section-heading");
        const optionGroup = containerEl.createDiv({ cls: "academic-export-settings-card" });
        new Setting(optionGroup).setName("Default paper type").setDesc("Recommended section structure selected when this format opens.").addDropdown((dropdown) => {
          format.variants.forEach((variant) => { dropdown.addOption(variant.id, variant.name); });
          dropdown.setValue(state.defaultVariant).onChange((value) => { state.defaultVariant = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter()); });
        });
        for (const option of format.options) new Setting(optionGroup).setName(option.label).setDesc(option.description).addToggle((toggle) => toggle.setValue(state.options[option.key] ?? option.default).onChange((value) => { state.options[option.key] = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter()); }));
      }
    }
    new Setting(containerEl).setName("Behavior").setHeading().settingEl.addClass("academic-export-section-heading");
    const generalGroup = containerEl.createDiv({ cls: "academic-export-settings-card" });
    new Setting(generalGroup).setName("Enable automatic exporting").setDesc("Export immediately when configured choices are valid; otherwise open the selection popup with missing-field warnings.").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoDefaultExporting).onChange((value) => { this.plugin.settings.autoDefaultExporting = value; void this.plugin.saveSettings(); }));
    new Setting(generalGroup).setName("Default save location").setDesc("Vault-relative folder on mobile and desktop fallback location.").addText((text) => text.setPlaceholder("Exports").setValue(this.plugin.settings.defaultSaveLocation).onChange((value) => { this.plugin.settings.defaultSaveLocation = normalizePath(value || "Exports"); void this.plugin.saveSettings(); }));
    new Setting(generalGroup).setName("Author").setDesc("Pre-fills the author property when creating a new export template.").addText((text) => text.setPlaceholder("Author name").setValue(this.plugin.settings.defaultAuthor).onChange((value) => { this.plugin.settings.defaultAuthor = value.trim(); void this.plugin.saveSettings(); }));
    new Setting(generalGroup).setName("Affiliation").setDesc("Pre-fills the affiliation property when creating a new export template.").addText((text) => text.setPlaceholder("Department, institution").setValue(this.plugin.settings.defaultAffiliation).onChange((value) => { this.plugin.settings.defaultAffiliation = value.trim(); void this.plugin.saveSettings(); }));
    new Setting(generalGroup).setName("Show page counter").setDesc("Show the selected format's calculated PDF page count in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showPageCounter).onChange((value) => { this.plugin.settings.showPageCounter = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter()); }));
    new Setting(generalGroup).setName("Page counter format").setDesc("Document style used to calculate the status-bar page count.").addDropdown((dropdown) => {
      BUILT_IN_FORMATS.forEach((format) => { dropdown.addOption(format.id, format.name); });
      dropdown.setValue(this.plugin.settings.pageCounterFormat).onChange((value) => { this.plugin.settings.pageCounterFormat = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter()); });
    });
    new Setting(generalGroup).setName("Back up notes before replacement").setDesc("Creates a timestamped .backup.md copy next to the note.").addToggle((toggle) => toggle.setValue(this.plugin.settings.createBackups).onChange((value) => { this.plugin.settings.createBackups = value; void this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("About").setHeading().settingEl.addClass("academic-export-section-heading");
    const about = containerEl.createEl("p");
    about.appendText("Thanks so much for using Academic Export. I hope you love it and it gives you joy! If it doesn’t, then I didn’t make it. If you have suggestions for new formats or want to add an existing format, open a ticket on ");
    about.createEl("a", { text: "GitHub", href: PROJECT.githubUrl }); about.appendText(" and let’s make it happen! :) You can also support the project on "); about.createEl("a", { text: "Ko-fi", href: PROJECT.kofiUrl }); about.appendText(".");
  }
}
