import student from "./apa-7-student.json";
import professional from "./apa-7-professional.json";
import mla from "./mla-9.json";
import chicago from "./chicago-18.json";
import ieee from "./ieee-conference.json";
import harvardThesis from "./harvard-thesis.json";
import harvardAuthorDate from "./harvard-author-date.json";
import ama from "./ama-11.json";
import type { DocumentFormat } from "../types";

export const BUILT_IN_FORMATS = [student, professional, mla, chicago, ieee, harvardThesis, harvardAuthorDate, ama] as DocumentFormat[];
export const FORMAT_BY_ID = new Map(BUILT_IN_FORMATS.map((format) => [format.id, format]));
