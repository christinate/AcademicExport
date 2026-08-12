import { describe, expect, it } from "vitest";
import { BUILT_IN_FORMATS, exportVariantSelector, normalizeExportVariant } from "../src/formats";
import { parseNote } from "../src/note";
import { plainText, renderDocument } from "../src/render";
import { exportArtifact } from "../src/exporters";

describe("APA semantic Markdown rendering", () => {
  it("preserves emphasis and creates post-reference addenda", () => {
    const note = parseNote(`---
Title: Test Paper
Author: Student
Affiliation: School
Course: Course
Instructor: Instructor
DueDate: 2026-08-09
---

Body with *italic* and **bold** text.

## References

Example, A. (2026). *Example title*.

## Table 1

*Example Results*

| Year | *M* | *SD* |
| --- | --- | --- |
| 2026 | 1.0 | 2.0 |

## Figure 1

*Example Figure*

![[figure.png]] *Note.* Example note.
`);
    const rendered = renderDocument(note, BUILT_IN_FORMATS[0], "general-student", { includeTitlePage: true, includeAbstract: false });
    const body = rendered.blocks.find((block) => block.kind === "paragraph");
    expect(body?.kind === "paragraph" && body.spans.some((span) => span.italic && span.text === "italic")).toBe(true);
    expect(rendered.references[0].some((span) => span.italic)).toBe(true);
    expect(rendered.addenda.map((page) => plainText(page.title))).toEqual(["Table 1", "Figure 1"]);
    expect(rendered.addenda[0].blocks.some((block) => block.kind === "table")).toBe(true);
    expect(rendered.addenda[1].blocks.some((block) => block.kind === "image")).toBe(true);
    expect(rendered.addenda[1].blocks.map((block) => block.kind)).toEqual(["paragraph", "image", "paragraph"]);
  });

  it("parses Obsidian table syntax, escaped pipes, aliases, and cell embeds", () => {
    const note = parseNote(`---
Title: Table Test
Author: Student
Affiliation: School
Course: Course
Instructor: Instructor
DueDate: 2026-08-10
References: ''
---

Name | Details | Visual
--- | --- | ---
[[Source Note|Friendly name]] | A \\| B | ![[chart.png|Chart]]
`);
    const rendered = renderDocument(note, BUILT_IN_FORMATS[0], "general-student", { includeTitlePage: true, includeAbstract: false });
    const block = rendered.blocks.find((item) => item.kind === "table");
    expect(block?.kind).toBe("table");
    if (block?.kind !== "table") return;
    expect(plainText(block.table.rows[1][0].spans)).toBe("Friendly name");
    expect(plainText(block.table.rows[1][1].spans)).toBe("A | B");
    expect(block.table.rows[1][2].images[0].source).toBe("chart.png");
  });

  it("recognizes inline and display LaTeX math", () => {
    const note = parseNote(`---
Title: Math Test
Author: Student
Affiliation: School
Course: Course
Instructor: Instructor
DueDate: 2026-08-10
References: ''
---

Reliability was $\\alpha = .87$.

$$
\\frac{a+b}{c}
$$
`);
    const rendered = renderDocument(note, BUILT_IN_FORMATS[0], "general-student", { includeTitlePage: true, includeAbstract: false });
    const paragraph = rendered.blocks.find((block) => block.kind === "paragraph");
    expect(paragraph?.kind === "paragraph" && paragraph.spans.some((span) => span.math?.alt === "\\alpha = .87")).toBe(true);
    expect(rendered.blocks.some((block) => block.kind === "image" && block.image.source.startsWith("math-display:"))).toBe(true);
  });
});

describe("MLA semantic Markdown rendering", () => {
  it("recognizes Works Cited and uses the MLA first-page heading option", () => {
    const note = parseNote(`---
Title: Reading Across Contexts
Author: Alex Morgan
Instructor: Dr. Rivera
Course: ENGL 201
DueDate: 2026-08-09
---

# Reading Across Contexts

The essay begins here.

## Works Cited

Morrison, Toni. *Beloved*. Vintage, 2004.
`);
    const format = BUILT_IN_FORMATS.find((item) => item.id === "mla-9")!;
    const rendered = renderDocument(note, format, "general-research-paper", { includeFirstPageHeading: true });
    expect(rendered.includeTitlePage).toBe(true);
    expect(rendered.references).toHaveLength(1);
    expect(rendered.references[0].some((span) => span.italic && span.text === "Beloved")).toBe(true);
  });
});

describe("additional document styles", () => {
  it("loads Chicago, IEEE, both Harvard styles, and AMA", () => {
    expect(BUILT_IN_FORMATS.map((format) => format.id)).toEqual(expect.arrayContaining([
      "chicago-18", "ieee-conference", "harvard-thesis", "harvard-author-date", "ama-11"
    ]));
    expect(BUILT_IN_FORMATS.find((format) => format.id === "chicago-18")?.variants.map((variant) => variant.id)).toEqual(["notes-bibliography", "author-date"]);
    expect(BUILT_IN_FORMATS.find((format) => format.id === "ama-11")?.variants.map((variant) => variant.id)).toEqual(["structured-abstract", "unstructured-abstract"]);
  });

  it("limits export-time variant selectors to Chicago and AMA", () => {
    const apa = BUILT_IN_FORMATS.find((format) => format.id === "apa-7-student")!;
    const chicago = BUILT_IN_FORMATS.find((format) => format.id === "chicago-18")!;
    const ama = BUILT_IN_FORMATS.find((format) => format.id === "ama-11")!;
    expect(exportVariantSelector(apa)).toBeUndefined();
    expect(exportVariantSelector(chicago)?.name).toBe("Citation system");
    expect(exportVariantSelector(ama)?.name).toBe("Abstract type");
    expect(normalizeExportVariant(apa, "quantitative-study")).toBe("general-student");
    expect(normalizeExportVariant(chicago, "author-date")).toBe("author-date");
    expect(normalizeExportVariant(ama, "unstructured-abstract")).toBe("unstructured-abstract");
  });

  it("renders a Bibliography body section as the source list", () => {
    const format = BUILT_IN_FORMATS.find((item) => item.id === "chicago-18")!;
    const note = parseNote(`---
Title: History Paper
Author: Student
Course: HIST 101
Instructor: Instructor
DueDate: 2026-08-12
---

Paper body.

## Bibliography

Author, A. *Book Title*. Publisher, 2026.
`);
    const rendered = renderDocument(note, format, "notes-bibliography", { includeTitlePage: true });
    expect(rendered.references).toHaveLength(1);
    expect(rendered.references[0].some((span) => span.italic && span.text === "Book Title")).toBe(true);
    expect(rendered.html).toContain("<h1>Bibliography</h1>");
    const authorDate = renderDocument(note, format, "author-date", { includeTitlePage: true });
    expect(authorDate.html).toContain("<h1>References</h1>");
  });

  it("exports Greek statistical symbols to PDF", async () => {
    const format = BUILT_IN_FORMATS.find((item) => item.id === "apa-7-professional")!;
    const note = parseNote(`---
Title: Reliability Analysis
Author: Researcher
Affiliation: Example University
Abstract: Cronbach's α was evaluated.
References: ''
---

Internal consistency was acceptable (α = .87).
`);
    const rendered = renderDocument(note, format, "general-professional", { includeTitlePage: true, includeAbstract: true });
    const artifact = await exportArtifact("pdf", rendered, format);
    expect(artifact.data.byteLength).toBeGreaterThan(1000);
  });
});
