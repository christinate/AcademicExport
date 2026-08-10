import { describe, expect, it } from "vitest";
import { missingFields, parseNote } from "../src/note";
import { BUILT_IN_FORMATS } from "../src/formats";

describe("note validation", () => {
  it("finds missing student data", () => {
    const note = parseNote("---\nTitle: Test\nReferences: ''\n---\nBody");
    const fields = missingFields(note, BUILT_IN_FORMATS[0], { includeTitlePage: true, includeAbstract: false });
    expect(fields).toContain("Author");
    expect(fields).not.toContain("References");
  });
});
