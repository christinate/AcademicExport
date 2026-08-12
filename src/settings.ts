import type { OutputType } from "./config";
import { BUILT_IN_FORMATS } from "./formats";
import type { FormatPreference, PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {
  formats: {
    "apa-7-student": {
      enabled: true,
      default: true,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true, includeAbstract: false }
    },
    "apa-7-professional": {
      enabled: true,
      default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true, includeAbstract: true, includeAuthorNote: true }
    },
    "mla-9": {
      enabled: true,
      default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeFirstPageHeading: true }
    },
    "chicago-18": {
      enabled: true, default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true }
    },
    "ieee-conference": {
      enabled: true, default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeAbstract: true }
    },
    "harvard-thesis": {
      enabled: true, default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true, includeAbstract: true }
    },
    "harvard-author-date": {
      enabled: true, default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true }
    },
    "ama-11": {
      enabled: true, default: false,
      outputTypes: { pdf: { enabled: true, default: true }, docx: { enabled: true, default: false }, html: { enabled: false, default: false } },
      options: { includeTitlePage: true, includeAbstract: true }
    }
  },
  autoDefaultExporting: false,
  defaultSaveLocation: "Exports",
  defaultAuthor: "",
  defaultAffiliation: "",
  showPageCounter: false,
  pageCounterFormat: "apa-7-student",
  createBackups: true,
  lastExportSelection: null
};

type LegacySettings = Partial<PluginSettings> & { outputTypes?: Record<string, { enabled: boolean; default: boolean }> };

export function mergeSettings(saved: LegacySettings | null): PluginSettings {
  const formats: PluginSettings["formats"] = {};
  for (const [id, defaults] of Object.entries(DEFAULT_SETTINGS.formats)) {
    const stored = saved?.formats?.[id];
    const legacyOutputs = saved?.outputTypes;
    formats[id] = {
      enabled: stored?.enabled ?? defaults.enabled,
      default: stored?.default ?? defaults.default,
      options: { ...defaults.options, ...stored?.options },
      outputTypes: Object.fromEntries(Object.entries(defaults.outputTypes).map(([type, state]) => [type, {
        ...state,
        ...(legacyOutputs?.[type] ?? {}),
        ...(stored?.outputTypes?.[type as OutputType] ?? {})
      }])) as FormatPreference["outputTypes"]
    };
  }
  return {
    formats,
    autoDefaultExporting: saved?.autoDefaultExporting ?? DEFAULT_SETTINGS.autoDefaultExporting,
    defaultSaveLocation: saved?.defaultSaveLocation ?? DEFAULT_SETTINGS.defaultSaveLocation,
    defaultAuthor: saved?.defaultAuthor ?? DEFAULT_SETTINGS.defaultAuthor,
    defaultAffiliation: saved?.defaultAffiliation ?? DEFAULT_SETTINGS.defaultAffiliation,
    showPageCounter: saved?.showPageCounter ?? DEFAULT_SETTINGS.showPageCounter,
    pageCounterFormat: saved?.pageCounterFormat && BUILT_IN_FORMATS.some((format) => format.id === saved.pageCounterFormat) ? saved.pageCounterFormat : DEFAULT_SETTINGS.pageCounterFormat,
    createBackups: saved?.createBackups ?? DEFAULT_SETTINGS.createBackups,
    lastExportSelection: saved?.lastExportSelection ?? DEFAULT_SETTINGS.lastExportSelection
  };
}
