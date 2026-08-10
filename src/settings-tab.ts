import { PluginSettingTab, normalizePath, type SettingDefinition, type SettingDefinitionItem } from "obsidian";
import { OUTPUT_LABELS, OUTPUT_TYPES, PROJECT } from "./config";
import { BUILT_IN_FORMATS } from "./formats";
import type AcademicExportPlugin from "./main";

export class ExportSettingTab extends PluginSettingTab {
  constructor(private plugin: AcademicExportPlugin) { super(plugin.app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const definitions: SettingDefinitionItem[] = [{
      name: "Academic Export settings",
      searchable: false,
      render: (setting) => {
        setting.settingEl.empty();
        setting.settingEl.createEl("p", { text: "Choose which document styles and output types appear in the export dialog." });
      }
    }];

    for (const format of BUILT_IN_FORMATS) {
      const state = this.plugin.settings.formats[format.id];
      const availability: SettingDefinition[] = [{
        name: "Availability columns",
        searchable: false,
        render: (setting) => {
          setting.settingEl.empty();
          setting.settingEl.addClass("academic-export-column-heading");
          setting.settingEl.createSpan();
          setting.settingEl.createSpan({ text: "Available", cls: "academic-export-column-label" });
        }
      }, {
        name: "Include in list",
        desc: format.description,
        aliases: [format.name, "available format"],
        render: (setting) => {
          setting.settingEl.addClass("academic-export-available-setting");
          setting.addToggle((toggle) => toggle.setTooltip("Show in format selectors").setValue(state.enabled).onChange((enabled) => {
            state.enabled = enabled;
            void this.plugin.saveSettings().then(() => this.update());
          }));
        }
      }];
      for (const type of OUTPUT_TYPES) {
        const output = state.outputTypes[type];
        availability.push({
          name: OUTPUT_LABELS[type],
          desc: `Offer ${OUTPUT_LABELS[type]} when exporting ${format.name}.`,
          aliases: [format.name, "output type"],
          render: (setting) => {
            setting.settingEl.addClass("academic-export-available-setting");
            setting.addToggle((toggle) => toggle.setTooltip(`Offer ${OUTPUT_LABELS[type]} for ${format.name}`).setValue(output.enabled).onChange((enabled) => {
              output.enabled = enabled;
              void this.plugin.saveSettings();
            }));
          }
        });
      }
      definitions.push({ type: "group", heading: format.name, cls: "academic-export-settings-card", items: availability });

      if (format.options.length) {
        const optionTitle = format.id === "apa-7-student" ? "APA Student 7 format" : format.id === "apa-7-professional" ? "APA Professional 7 format" : `${format.name} format`;
        const optionItems: SettingDefinition[] = [{
          name: "Default paper type",
          desc: "Recommended section structure selected when this format opens.",
          aliases: [format.name, "variant"],
          render: (setting) => { setting.addDropdown((dropdown) => {
            format.variants.forEach((variant) => { dropdown.addOption(variant.id, variant.name); });
            dropdown.setValue(state.defaultVariant).onChange((value) => {
              state.defaultVariant = value;
              void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter());
            });
          }); }
        }];
        for (const option of format.options) optionItems.push({
          name: option.label,
          desc: option.description,
          aliases: [format.name, "format option"],
          render: (setting) => { setting.addToggle((toggle) => toggle.setValue(state.options[option.key] ?? option.default).onChange((value) => {
            state.options[option.key] = value;
            void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter());
          })); }
        });
        definitions.push({ type: "group", heading: optionTitle, cls: "academic-export-settings-card", items: optionItems });
      }
    }

    definitions.push({ type: "group", heading: "Behavior", cls: "academic-export-settings-card", items: [{
      name: "Enable automatic exporting",
      desc: "Export immediately when configured choices are valid; otherwise open the selection popup with missing-field warnings.",
      control: { type: "toggle", key: "autoDefaultExporting" }
    }, {
      name: "Default save location",
      desc: "Vault-relative folder on mobile and desktop fallback location.",
      render: (setting) => { setting.addText((text) => text.setPlaceholder("Exports").setValue(this.plugin.settings.defaultSaveLocation).onChange((value) => {
        this.plugin.settings.defaultSaveLocation = normalizePath(value || "Exports"); void this.plugin.saveSettings();
      })); }
    }, {
      name: "Author",
      desc: "Pre-fills the author property when creating a new export template.",
      render: (setting) => { setting.addText((text) => text.setPlaceholder("Author name").setValue(this.plugin.settings.defaultAuthor).onChange((value) => {
        this.plugin.settings.defaultAuthor = value.trim(); void this.plugin.saveSettings();
      })); }
    }, {
      name: "Affiliation",
      desc: "Pre-fills the affiliation property when creating a new export template.",
      render: (setting) => { setting.addText((text) => text.setPlaceholder("Department, institution").setValue(this.plugin.settings.defaultAffiliation).onChange((value) => {
        this.plugin.settings.defaultAffiliation = value.trim(); void this.plugin.saveSettings();
      })); }
    }, {
      name: "Show page counter",
      desc: "Show the selected format's calculated PDF page count in the status bar.",
      render: (setting) => { setting.addToggle((toggle) => toggle.setValue(this.plugin.settings.showPageCounter).onChange((value) => {
        this.plugin.settings.showPageCounter = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter());
      })); }
    }, {
      name: "Page counter format",
      desc: "Document style used to calculate the status-bar page count.",
      render: (setting) => { setting.addDropdown((dropdown) => {
        BUILT_IN_FORMATS.forEach((format) => { dropdown.addOption(format.id, format.name); });
        dropdown.setValue(this.plugin.settings.pageCounterFormat).onChange((value) => {
          this.plugin.settings.pageCounterFormat = value; void this.plugin.saveSettings().then(() => this.plugin.refreshPageCounter());
        });
      }); }
    }, {
      name: "Back up notes before replacement",
      desc: "Creates a timestamped .backup.md copy next to the note.",
      control: { type: "toggle", key: "createBackups" }
    }] });

    definitions.push({ type: "group", heading: "About", items: [{
      name: "About Academic Export",
      searchable: false,
      render: (setting) => {
        setting.settingEl.empty();
        const about = setting.settingEl.createEl("p");
        about.appendText("Thanks so much for using Academic Export. I hope you love it and it gives you joy! If it doesn’t, then I didn’t make it. If you have suggestions for new formats or want to add an existing format, open a ticket on ");
        about.createEl("a", { text: "GitHub", href: PROJECT.githubUrl }); about.appendText(" and let’s make it happen! :) You can also support the project on ");
        about.createEl("a", { text: "Ko-fi", href: PROJECT.kofiUrl }); about.appendText(".");
      }
    }] });
    return definitions;
  }
}
