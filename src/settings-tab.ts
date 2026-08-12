import { Notice, PluginSettingTab, normalizePath, type SettingDefinition, type SettingDefinitionItem } from "obsidian";
import { OUTPUT_LABELS, OUTPUT_TYPES, PROJECT, type OutputType } from "./config";
import { chooseDesktopFolder } from "./destination";
import { BUILT_IN_FORMATS } from "./formats";
import type AcademicExportPlugin from "./main";

const FORMAT_PREFIX = "format:";

export class ExportSettingTab extends PluginSettingTab {
  constructor(private plugin: AcademicExportPlugin) { super(plugin.app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const definitions: SettingDefinitionItem[] = [{
      type: "group",
      heading: "About Academic Export",
      items: [{
        name: "About Academic Export",
        aliases: ["GitHub", "ko-fi", "support"],
        render: (setting) => {
          setting.infoEl.empty();
          setting.infoEl.append(this.createAboutDescription());
          setting.settingEl.addClass("academic-export-about-content");
        }
      }]
    }, {
      type: "group",
      heading: "General Settings",
      items: [{
        name: "Enable automatic exporting",
        desc: "Export immediately when configured choices are valid; otherwise open the selection popup with missing-field warnings.",
        control: { type: "toggle", key: "autoDefaultExporting" }
      }, {
        name: "Default save location",
        desc: `Default folder for Save As dialogs: ${this.plugin.settings.defaultSaveLocation}.`,
        aliases: ["export folder", "destination"],
        render: (setting) => {
          setting.addButton((button) => button.setButtonText("Choose folder").onClick(() => void this.openFolderPicker()));
        }
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
      }]
    }];
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
      if (format.options.length) {
        for (const option of format.options) availability.push({
          name: option.label,
          desc: option.description,
          aliases: [format.name, "format option"],
          control: { type: "toggle", key: `${FORMAT_PREFIX}${format.id}:option:${option.key}` }
        });
      }
      definitions.push({ type: "group", heading: format.name, items: availability });
    }
    return definitions;
  }

  private createAboutDescription(): DocumentFragment {
    const projectSegments = PROJECT.githubUrl.split("/");
    const repositoryName = projectSegments[projectSegments.length - 1] || "AcademicExport";
    const projectName = repositoryName.replace(/([a-z])([A-Z])/g, "$1 $2");
    const donationLabel = "Donate to my ko-fi here".replace(/^D/, "d");

    return createFragment((fragment) => {
      const intro = fragment.createEl("p");
      const projectLink = intro.createEl("a", { href: PROJECT.githubUrl });
      projectLink.textContent = projectName;
      intro.append(" is a cross-platform Obsidian community plugin that turns Markdown notes into consistently styled documents. Choose APA 7, MLA 9, Chicago 18, IEEE Conference, Harvard Extension School Thesis, Harvard Author-Date, or AMA 11, then select PDF, DOCX, or HTML and the options for that style.");

      const support = fragment.createEl("p");
      support.append("Show some love! If you like it and want to help a student, please ");
      const kofiLink = support.createEl("a", { href: PROJECT.kofiUrl });
      kofiLink.textContent = donationLabel;
      support.append(".");
    });
  }

  private async openFolderPicker(): Promise<void> {
    const choice = await chooseDesktopFolder(this.plugin.app, this.plugin.settings.defaultSaveLocation);
    if (!choice.available) {
      new Notice("System folder selection is available in the desktop app.");
      return;
    }
    if (!choice.folderPath) return;
    this.plugin.settings.defaultSaveLocation = choice.folderPath;
    await this.plugin.saveSettings();
    this.update();
  }

  getControlValue(key: string): unknown {
    if (!key.startsWith(FORMAT_PREFIX)) return this.plugin.settings[key as keyof typeof this.plugin.settings];
    const [, formatId, kind, detail] = key.split(":");
    const state = this.plugin.settings.formats[formatId];
    if (!state) return undefined;
    if (kind === "enabled") return state.enabled;
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
