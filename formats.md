# Document format catalog

Academic Export separates a **document style** from an **output type**. APA 7 Student is a document style; PDF is an output type. A single rendering request combines one style with one or more output types.

## Implemented document styles

| Style | Definition JSON | Markdown template | Status |
|---|---|---|---|
| APA 7 Student | [`src/formats/apa-7-student.json`](src/formats/apa-7-student.json) | [`templates/apa-7-student.md`](templates/apa-7-student.md) | Initial implementation |
| APA 7 Professional | [`src/formats/apa-7-professional.json`](src/formats/apa-7-professional.json) | [`templates/apa-7-professional.md`](templates/apa-7-professional.md) | Initial implementation |
| MLA 9 | [`src/formats/mla-9.json`](src/formats/mla-9.json) | [`templates/mla-9.md`](templates/mla-9.md) | Initial implementation |
| Chicago 18 | [`src/formats/chicago-18.json`](src/formats/chicago-18.json) | [`templates/chicago-18.md`](templates/chicago-18.md) | Notes–Bibliography and Author–Date |
| IEEE Conference | [`src/formats/ieee-conference.json`](src/formats/ieee-conference.json) | [`templates/ieee-conference.md`](templates/ieee-conference.md) | Two-column conference manuscript |
| Harvard Extension School Thesis | [`src/formats/harvard-thesis.json`](src/formats/harvard-thesis.json) | [`templates/harvard-thesis.md`](templates/harvard-thesis.md) | ALM thesis |
| Harvard Author-Date | [`src/formats/harvard-author-date.json`](src/formats/harvard-author-date.json) | [`templates/harvard-author-date.md`](templates/harvard-author-date.md) | General institutional author-date baseline |
| AMA 11 | [`src/formats/ama-11.json`](src/formats/ama-11.json) | [`templates/ama-11.md`](templates/ama-11.md) | Structured and unstructured abstracts |

### APA 7 paper-type variants

Student variants: General Student Paper, Annotated Bibliography, Design Project, Discussion Post, Journalism Assignment, Literature Review, and Quantitative Study.

Professional variants: General Professional Manuscript, Literature Review, Mixed Methods Study, Qualitative Study, Quantitative Study, and Review Article.

Variants declare recommended section sequences while inheriting the shared APA layout engine. They are based on the official [APA Style sample-paper downloads](https://apastyle.apa.org/style-grammar-guidelines/paper-format/sample-papers), last reviewed August 9, 2026.

### MLA 9 variants

MLA variants include General Research Paper, Literary Analysis, Comparative Essay, and Annotated Bibliography. They share the MLA page system while leaving discipline- and instructor-specific section organization flexible.

## Planned document styles

| Family | Likely variants | Research needed before implementation |
|---|---|---|
| Turabian | Notes–Bibliography; Author–Date | Current student-paper rules and institutional variations |
| Vancouver | Manuscript | Target journal requirements and ICMJE recommendations |

Planned entries are not specifications. Each must be researched from its owning organization or another authoritative source before its JSON and template are added.

## Additional style sources

- Chicago 18: [Chicago citation quick guide](https://www.chicagomanualofstyle.org/tools_citationguide.html) and official [student paper-formatting resources](https://www.chicagomanualofstyle.org/help-tools/Resources-for-Students.htmlInstructions). The supplied 17th-edition Word files were used only for comparative layout evidence.
- IEEE: official [conference authoring templates](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/authoring-tools-and-templates/) and [paper structure guidance](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/structure-your-paper/).
- Harvard Extension School Thesis: supplied Harvard thesis template, with Harvard’s [current dissertation page and text requirements](https://gsas.harvard.edu/resource/dissertation-formatting-guidance) used for shared institutional constraints.
- Harvard Author-Date: a conservative general author-date baseline. Harvard conventions vary by institution, so the exact guide assigned by an instructor or publisher controls citation punctuation.
- AMA 11: supplied Liberty University templates and sample paper, plus the [Liberty AMA 11 quick guide](https://www.liberty.edu/casas/academic-success-center/writing-style-guides/ama-guide/).

## Implemented output types

| Output | Exporter | Current scope |
|---|---|---|
| PDF | `src/exporters.ts` | Letter pages, one-inch margins, 12-point Times New Roman, double spacing, headers/page numbers, title/abstract/body/reference pagination, APA indents/headings, rich text, post-reference tables and figures |
| DOCX | `src/exporters.ts` | Explicit page geometry and header distance, automatic page fields, running heads, title/abstract/body/reference pagination, APA indents/headings, rich text, post-reference tables and figures |
| HTML | `src/exporters.ts` and `src/render.ts` | Self-contained semantic HTML and print CSS |

Output availability and defaults are configured independently for each document style. Markdown is not an output type because the source note is already Markdown.

## APA 7 source notes

The definitions use the official APA Style sample papers as their primary source, supplemented by Purdue OWL’s annotated guidance. Important modeled distinctions include:

- Student title data: title, author, department/institution, course, instructor, and due date.
- Student headers: page number without the professional running head by default.
- Professional title data: title, author, affiliation, and optional author note.
- Professional headers: abbreviated title/running head and page number.
- Professional abstract and keywords.
- Letter-size paper, one-inch margins, double spacing, and an approved readable font (the initial exporter uses 12-point Times New Roman).
- References on a new page with a centered heading, alphabetic entries, double spacing, and hanging indents as an exporter target.

Sources:

- [Official APA Style Sample Papers](https://apastyle.apa.org/style-grammar-guidelines/paper-format/sample-papers)
- [Purdue OWL APA Formatting and Style Guide](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/)
- [Purdue OWL APA 7 Student Sample Paper](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/documents/apa-7-student-sample-paper-2026.pdf)
- [Purdue OWL APA 7 Professional Sample Paper](https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/documents/apa-7-professional-sample-paper-20260321-revision.pdf)

The exporters treat each heading after References as a new addendum page and support APA-style tables, figures, captions, notes, and local embedded images. The JSON captures data requirements and general document rules; it does not claim coverage of every APA rule for equations, quotations, citations, footnotes, accessibility, or journal-specific submission systems.

## MLA 9 source notes

The MLA definition follows the current MLA Style Center’s paper-setup, heading, sample-paper, and works-cited guidance. It also uses the supplied Scribbr Word template as a practical comparison source; official MLA guidance controls if they conflict.

- [Using MLA Format](https://style.mla.org/mla-format/)
- [Sample Essays: Writing with MLA Style](https://style.mla.org/sample-papers/)
- [Styling Headings and Subheadings](https://style.mla.org/styling-headings-and-subheadings/)
- [Hanging Indents and Microsoft Word](https://style.mla.org/hanging-indents/)
