import { describe, expect, it } from "vitest";
import { missingFields, parseNote } from "../src/note";
import { BUILT_IN_FORMATS } from "../src/formats";

describe("note validation", () => {
  it("keeps legacy YAML references compatible", () => {
    const note = parseNote("---\nTitle: Test\nReferences: ''\n---\nBody");
    const fields = missingFields(note, BUILT_IN_FORMATS[0], { includeTitlePage: true, includeAbstract: false });
    expect(fields).toContain("Author");
    expect(fields).not.toContain("References");
  });

  it.each(["References", "Works Cited", "Bibliography"])("recognizes the %s body heading", (heading) => {
    const note = parseNote(`---\nTitle: Test\n---\nBody\n\n## ${heading}\n\nSource entry.`);
    const fields = missingFields(note, BUILT_IN_FORMATS[0], { includeTitlePage: true, includeAbstract: false });
    expect(fields).not.toContain("References");
  });

  it("reports a missing reference section", () => {
    const note = parseNote("---\nTitle: Test\n---\nBody only");
    const fields = missingFields(note, BUILT_IN_FORMATS[0], { includeTitlePage: true, includeAbstract: false });
    expect(fields).toContain("References");
  });
});
