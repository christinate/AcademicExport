export const PROJECT = {
  author: "christinate",
  githubUrl: "https://github.com/christinate/AcademicExport",
  kofiUrl: "https://ko-fi.com/christinate"
} as const;

export const OUTPUT_TYPES = ["pdf", "docx", "html"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];
export const OUTPUT_LABELS: Record<OutputType, string> = {
  pdf: "PDF",
  docx: "Microsoft Word (.docx)",
  html: "HTML"
};
