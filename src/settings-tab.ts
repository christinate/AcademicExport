import { PluginSettingTab, normalizePath, type SettingDefinition, type SettingDefinitionItem } from "obsidian";
import { OUTPUT_LABELS, OUTPUT_TYPES, PROJECT, type OutputType } from "./config";
import { BUILT_IN_FORMATS } from "./formats";
import type AcademicExportPlugin from "./main";

const FORMAT_PREFIX = "format:";

export class ExportSettingTab extends PluginSettingTab {
  constructor(private plugin: AcademicExportPlugin) { super(plugin.app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const definitions: SettingDefinitionItem[] = [];
    for (const format of BUILT_IN_FORMATS) {
      const availability: SettingDefinition[] = [{
        name: "Include in list",
        desc: format.description,
        aliases: [format.name, "available format"],
        control: { type: "toggle", key: `${FORMAT_PREFIX}${format.id}:enabled` }
      }];
      for (const type of OUTPUT_TYPES) availability.push({
        name: OUTPUT_LABELS[type],
        desc: `Offer ${OUTPUT_LABELS[type]} when exporting ${format.name}.`,
        aliases: [format.name, "output type"],
        control: { type: "toggle", key: `${FORMAT_PREFIX}${format.id}:output:${type}` }
      });
      definitions.push({ type: "group", heading: format.name, cls: "academic-export-settings-card", items: availability });

      if (format.options.length) {
        const optionTitle = format.id === "apa-7-student" ? "APA Student 7 format" : format.id === "apa-7-professional" ? "APA Professional 7 format" : `${format.name} format`;
        const options = Object.fromEntries(format.variants.map((variant) => [variant.id, variant.name]));
        const optionItems: SettingDefinition[] = [{
          name: "Default paper type",
          desc: "Recommended section structure selected when this format opens.",
          aliases: [format.name, "variant"],
          control: { type: "dropdown", key: `${FORMAT_PREFIX}${format.id}:variant`, options }
        }];
        for (const option of format.options) optionItems.push({
          name: option.label,
          desc: option.description,
          aliases: [format.name, "format option"],
          control: { type: "toggle", key: `${FORMAT_PREFIX}${format.id}:option:${option.key}` }
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
      control: { type: "text", key: "defaultSaveLocation", placeholder: "Exports" }
    }, {
      name: "Author",
      desc: "Pre-fills the author property when creating a new export template.",
      control: { type: "text", key: "defaultAuthor", placeholder: "Author name" }
    }, {
      name: "Affiliation",
      desc: "Pre-fills the affiliation property when creating a new export template.",
      control: { type: "text", key: "defaultAffiliation", placeholder: "Department, institution" }
    }, {
      name: "Show page counter",
      desc: "Show the selected format's calculated PDF page count in the status bar.",
      control: { type: "toggle", key: "showPageCounter" }
    }, {
      name: "Page counter format",
      desc: "Document style used to calculate the status-bar page count.",
      control: { type: "dropdown", key: "pageCounterFormat", options: Object.fromEntries(BUILT_IN_FORMATS.map((format) => [format.id, format.name])) }
    }, {
      name: "Back up notes before replacement",
      desc: "Creates a timestamped .backup.md copy next to the note.",
      control: { type: "toggle", key: "createBackups" }
    }] });
    definitions.push({ type: "group", heading: "About", items: [{
      name: "Academic Export",
      desc: `Request formats and report problems at ${PROJECT.githubUrl}. Support the project at ${PROJECT.kofiUrl}.`
    }] });
    return definitions;
  }

  getControlValue(key: string): unknown {
    if (!key.startsWith(FORMAT_PREFIX)) return this.plugin.settings[key as keyof typeof this.plugin.settings];
    const [, formatId, kind, detail] = key.split(":");
    const state = this.plugin.settings.formats[formatId];
    if (!state) return undefined;
    if (kind === "enabled") return state.enabled;
    if (kind === "variant") return state.defaultVariant;
    if (kind === "output") return state.outputTypes[detail as OutputType]?.enabled;
    if (kind === "option") return state.options[detail];
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    let refreshCounter = false;
    if (key.startsWith(FORMAT_PREFIX)) {
      const [, formatId, kind, detail] = key.split(":");
      const state = this.plugin.settings.formats[formatId];
      if (!state) return;
      if (kind === "enabled") state.enabled = Boolean(value);
      else if (kind === "variant") { state.defaultVariant = String(value); refreshCounter = true; }
      else if (kind === "output" && state.outputTypes[detail as OutputType]) state.outputTypes[detail as OutputType].enabled = Boolean(value);
      else if (kind === "option") { state.options[detail] = Boolean(value); refreshCounter = true; }
    } else if (key === "defaultSaveLocation") this.plugin.settings.defaultSaveLocation = normalizePath(String(value) || "Exports");
    else if (key === "defaultAuthor") this.plugin.settings.defaultAuthor = String(value).trim();
    else if (key === "defaultAffiliation") this.plugin.settings.defaultAffiliation = String(value).trim();
    else if (key === "autoDefaultExporting") this.plugin.settings.autoDefaultExporting = Boolean(value);
    else if (key === "showPageCounter") { this.plugin.settings.showPageCounter = Boolean(value); refreshCounter = true; }
    else if (key === "pageCounterFormat") { this.plugin.settings.pageCounterFormat = String(value); refreshCounter = true; }
    else if (key === "createBackups") this.plugin.settings.createBackups = Boolean(value);
    await this.plugin.saveSettings();
    if (refreshCounter) this.plugin.refreshPageCounter();
  }
}
