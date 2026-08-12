# Academic Export for Obsidian

Academic Export is a cross-platform [Obsidian](https://obsidian.md) community plugin that turns Markdown notes into consistently styled documents. Choose APA 7, MLA 9, Chicago 18, IEEE Conference, Harvard Extension School Thesis, Harvard Author-Date, or AMA 11, then select PDF, DOCX, or HTML and the options for that style.

Show some love! If you like it and want to help a student, please donate to my ko-fi here: https://ko-fi.com/christinate

## What it does

- Adds **Export in…** to note menus and the command palette.
- Lets you select one document style and multiple output types.
- Reopens **Export in…** with the document style, output types, format options, and any applicable Chicago citation system or AMA abstract type used for the previous interactive export.
- Includes student and professional APA paper-type variants based on the official APA sample-paper collection.
- Remembers the choices from the previous interactive export.
- Shows a readable warning such as `Title (APA 7 Student)` when data is missing.
- Adds **New export template** to folder context menus.
- Adds **Replace with template** to Markdown-file context menus.
- Creates a timestamped backup before replacing a note.
- Uses a desktop save dialog when Electron exposes it, with a safe vault-folder fallback.
- Saves to a configured folder inside the vault on mobile.

## How a note supplies document data

Templates use YAML frontmatter for document metadata and Markdown for the body:

```markdown
---
Title: "My Paper"
Author:
  - "Ada Lovelace"
Affiliation: "Department, University"
Course: "WRIT 101: Academic Writing"
Instructor: "Professor Name"
DueDate: "2026-08-09"
---

# My Paper

The paper begins here.

## References

Add one reference per paragraph.
```

References belong in the Markdown body under `## References`, `## Works Cited`, or `## Bibliography`, not in YAML. Older notes that store references in the YAML `References` or `WorksCited` property remain supported.

### Tables, figures, and post-reference addenda

Every Markdown heading after `## References` starts a separate addendum page. This makes an APA table or figure straightforward to author in Obsidian:

```markdown
## Table 1

*Means and Standard Deviations for Response Rates*

| Administration year | Face-to-face M | Face-to-face SD | Online M | Online SD |
| --- | --- | --- | --- | --- |
| Year 1: 2012 | 71.72 | 16.42 | 32.93 | 15.73 |

*Note.* Explain abbreviations and other necessary details here.

## Figure 1

*Scatterplot Depicting the Correlation Between Response Rates and Evaluation Ratings*

![[Pasted image.png]]

*Note.* Explain the figure here.
```

The heading, caption, table or image, and note stay together as that addendum’s content. Each following heading starts another page. Obsidian embeds (`![[image.png]]`) and standard Markdown images (`![alt](image.png)`) are resolved through the vault. Images are never enlarged beyond their original size and are reduced to fit both the usable page width and height. Images inside table cells are retained too. PDF supports PNG and JPEG images; Word additionally supports GIF and BMP.

Markdown emphasis carries into exports: `*italic*`, `**bold**`, `***bold italic***`, `~~strikethrough~~`, and inline code. Italicize APA table and figure titles and the `Note.` label in the source note as shown above.

Field names are intentionally consistent across styles. For example, every style that needs a title uses `Title`, not `paperTitle` or `document_name`. See [json.md](json.md) for the complete schema, naming rules, validation behavior, and instructions for adding another style. See [formats.md](formats.md) for the format catalog and file map.

## Commands and menus

### Export in…

Open a Markdown note and use its menu or run **Academic Export: Export in…**. Select one document style, any number of enabled output types, and style-specific options. When the selected, enabled style is Chicago 18, the popup also shows **Citation system**; when it is AMA 11, it shows **Abstract type**. Other styles do not show a generic paper-type selector because paper types only affect their generated template outlines. Select **Export** to generate every chosen output. The next time the window opens, it restores the choices from the previous interactive export; unavailable choices safely fall back to configured defaults. Standard and Obsidian-style pipe tables are supported, including optional outer pipes, escaped pipes, wiki-link aliases, and embedded images inside cells.

Embed an Obsidian Canvas with `![[My canvas.canvas]]` or an extensionless `![[My canvas]]` link that resolves to a `.canvas` file. Academic Export rasterizes its nodes, groups, labels, and connecting arrows to PNG and inserts the result at the embed position. File and link cards are represented by their labels or paths; live webpage previews and interactive Canvas behavior are not part of a static document export.

Inline LaTeX uses Obsidian's `$...$` syntax, for example `$\\alpha = .87$`. Display equations use `$$` delimiters on their own lines. MathJax renders both forms before PDF or Word generation so fractions, roots, sums, matrices, Greek letters, subscripts, superscripts, and common AMS commands retain their mathematical layout.

APA paper types currently include:

- Student: general paper, annotated bibliography, design project, discussion post, journalism assignment, literature review, and quantitative study.
- Professional: general manuscript, literature review, mixed methods study, qualitative study, quantitative study, and review article.

Paper types share the APA page system but provide different recommended section structures when creating or replacing templates. They are not shown in **Export in…** because they do not restyle an existing note. Instructor, department, institution, publisher, and journal requirements can override APA defaults.

MLA 9 includes general research paper, literary analysis, comparative essay, and annotated-bibliography starting structures. MLA output uses the conventional first-page author/instructor/course/date heading, centered unbolded title, surname and page number in the upper-right header, double spacing, half-inch paragraph indents, and a separately paginated Works Cited list with hanging indents. Instructor requirements override these defaults.

Chicago 18 offers Notes and Bibliography or Author-Date. IEEE Conference uses a full-width title/author/abstract block followed by a two-column manuscript. Harvard Extension School Thesis and general Harvard Author-Date are separate selectable formats. AMA 11 offers structured and unstructured abstract variants; write an AMA superscript citation as `^1^` in Markdown.

### New export template

Right-click a vault folder, select **New export template**, choose one enabled style, and select a paper type. The plugin copies its bundled Markdown template with that paper type's recommended section outline into a new, uniquely named note and opens it.

### Replace with template

Right-click a Markdown file, select **Replace with template**, choose a style, and confirm. By default, the plugin first creates a sibling file named like:

```text
Original note.2026-08-09T12-34-56-000Z.backup.md
```

## Settings

The **Academic Export** community-plugin settings include:

- Available formats are grouped by document style. Each group has a labeled **Available** column for controlling what appears in Export in….
- Every style owns its output-type settings. For example, APA can offer PDF and Word while another style can be limited to PDF.
- Style-specific switches, such as **Include title page**, appear in the same group as that style.
- Paper-type defaults are not settings; paper types are selected while creating or replacing a template.
- General options are separated from the available-format groups.
- **Default save location**, a vault-relative mobile/fallback folder.
- **Show Page Counter**, which adds the selected style's exact generated-PDF page count to Obsidian's status bar after a short idle delay.
- **Page counter format**, which selects the document style used for that calculation. Clicking the status-bar counter shows where to change the setting.
- **Author** and **Affiliation**, used to pre-fill those YAML properties in newly generated templates.
- **Back up notes before replacement**.

## Installation

### Installing from Obsidian Community Plugins

Ordinary users do **not** need Node.js or npm. Once Academic Export is published in the Community Plugins catalog:

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **Academic Export**.
3. Select **Install**, then **Enable**.

Obsidian downloads the compiled plugin files. The APA templates and runtime libraries are embedded in `main.js`, so users do not need to install packages or copy templates separately.

### Manual installation

To test a compiled build before it is available in Community Plugins, copy these files:

```text
main.js
manifest.json
styles.css
```

into:

```text
<vault>/.obsidian/plugins/academic-export/
```

Reload Obsidian and enable **Academic Export** under **Settings → Community plugins**. Manual installation does not require npm when the three compiled files have already been provided.

### Development and compilation

npm is only required for developing or compiling Academic Export. It downloads TypeScript, the build tools, PDF/DOCX libraries, and other development dependencies; it is not part of the end-user installation process.

Requirements: Node.js 20.19 or newer and a current Obsidian desktop installation.

Run once after cloning the repository or whenever dependencies change:

```bash
npm install
```

Compile and bundle the source into `main.js`:

```bash
npm run build
```

For automatic rebuilding while developing:

```bash
npm run dev
```

## Current limitations

- The semantic Markdown renderer supports headings, paragraphs, core inline emphasis, links, Obsidian-compatible pipe tables, local image embeds, and static Canvas snapshots, but not every Obsidian Markdown extension.
- PDF and DOCX output enforce APA page geometry, 12-point Times New Roman, double spacing, paragraph and reference indents, page numbering, title/abstract/body/reference pagination, heading levels, and professional running heads.
- Footnotes, complex lists, remote images, general SVG embeds, video, audio, and arbitrary HTML are not yet publication-ready. Inline and display LaTeX math are supported through MathJax.
- Electron’s native save dialog is not a stable public Obsidian mobile API. If it is unavailable on desktop, exports use the configured vault folder.
- User-supplied JSON discovery and arbitrary renderer scripting are intentionally deferred until schemas can be validated and loaded safely.

## Privacy and file access

Academic Export does not include telemetry, advertising, user accounts, or network requests. It reads the active note and only the vault images or Canvas files embedded by that note. Exports are written either to the configured vault folder or, on desktop, to a location explicitly selected through the save dialog. Replacing a template modifies the selected note and can create a timestamped backup beside it.

## Contributing formats

Start with [json.md](json.md), copy the closest definition from `src/formats`, and add a matching template under `templates`. Keep definitions declarative: JSON describes required data and layout rules; TypeScript exporters decide how those rules map to a file type.

Issues and pull requests are welcome at [christinate/AcademicExport](https://github.com/christinate/AcademicExport).

## License

[MIT](LICENSE)

## What's New in Version 0.1.3

- Rebuilt LaTeX math export around a self-contained, lazily initialized renderer that preserves fractions, roots, Greek letters, subscripts, and superscripts without slowing plugin startup.
- Standardized inline and display equation sizing while keeping oversized equations within the printable page area.
- Moved references out of generated YAML and into `## References`, `## Works Cited`, or `## Bibliography` sections in the Markdown body; legacy YAML references remain supported.
- Added Author and Affiliation pre-filling when replacing an existing note with an export template.
- Removed the generic **Paper type** selector from **Export in…** and the unused default paper-type setting.
- Added a conditional **Citation system** selector for enabled Chicago 18 exports and an **Abstract type** selector for enabled AMA 11 exports.
- Kept paper-type choices in the template creation and replacement workflows, where they generate the appropriate recommended section outline.
- Made Chicago source-list headings follow the selected citation system in PDF, DOCX, and HTML exports.
