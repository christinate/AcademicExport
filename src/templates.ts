import apaStudent from "../templates/apa-7-student.md";
import apaProfessional from "../templates/apa-7-professional.md";
import mla from "../templates/mla-9.md";
import chicago from "../templates/chicago-18.md";
import ieee from "../templates/ieee-conference.md";
import harvardThesis from "../templates/harvard-thesis.md";
import harvardAuthorDate from "../templates/harvard-author-date.md";
import ama from "../templates/ama-11.md";

export const BUNDLED_TEMPLATES: Record<string, string> = {
  "templates/apa-7-student.md": apaStudent,
  "templates/apa-7-professional.md": apaProfessional,
  "templates/mla-9.md": mla,
  "templates/chicago-18.md": chicago,
  "templates/ieee-conference.md": ieee,
  "templates/harvard-thesis.md": harvardThesis,
  "templates/harvard-author-date.md": harvardAuthorDate,
  "templates/ama-11.md": ama
};
