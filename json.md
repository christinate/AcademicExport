# Academic Export document-format JSON

This file is the normative contributor and AI-authoring guide for document-style definitions. A definition describes required note data, configurable sections, general page rules, and its starter template. It must not contain executable JavaScript.

## Design rules

1. A style definition is not an output type. Do not put PDF- or DOCX-specific implementation in JSON.
2. Reuse canonical field names. Every title is `Title`; every author list is `Author`.
3. Put variant-specific labels in `label`, not in the canonical key.
4. Use `aliases` only to accept common legacy fields. Templates must use the canonical key.
5. Mark a field required only when the authoritative style requires it for that variant.
6. Describe options declaratively. An option controls rendering; it never runs code.
7. Cite authoritative research in `formats.md` before adding a definition.
8. Add a complete Markdown template whose YAML uses every required metadata field and whose body demonstrates required document sections.

## Schema

```json
{
  "schemaVersion": 1,
  "id": "lowercase-hyphenated-id",
  "name": "Human-readable name",
  "description": "Short selector description.",
  "templateFile": "templates/lowercase-hyphenated-id.md",
  "fields": [
    {
      "key": "Title",
      "label": "Title",
      "type": "string",
      "required": true,
      "description": "Full document title.",
      "aliases": ["LegacyTitle"]
    }
  ],
  "options": [
    {
      "key": "includeTitlePage",
      "label": "Include title page",
      "description": "Create the style's title page.",
      "default": true
    }
  ],
  "rules": {
    "size": "letter",
    "marginInches": 1,
    "fontFamily": "Times New Roman",
    "fontSizePoints": 12,
    "lineSpacing": 2,
    "paragraphIndentInches": 0.5,
    "pageNumbers": true,
    "runningHead": false
  },
  "sections": [
    {
      "key": "Body",
      "label": "Paper body",
      "required": true,
      "pageBreakBefore": false
    }
  ],
  "variants": [
    {
      "id": "general-student",
      "name": "General Student Paper",
      "description": "Standard course paper.",
      "recommendedSections": [],
      "abstractDefault": false
    }
  ]
}
```

## Properties

### Root

- `schemaVersion`: integer schema version. Version 1 is the only supported value.
- `id`: stable lowercase hyphenated identifier; it must match the JSON/template basename.
- `name`: concise display name.
- `description`: one sentence suitable for a picker.
- `templateFile`: plugin-root-relative Markdown template path.
- `fields`: YAML frontmatter metadata requirements.
- `options`: user-controllable rendering choices.
- `rules`: output-neutral page geometry and typography.
- `sections`: ordered semantic document sections.
- `variants`: paper-type structures that inherit the format's shared page rules.

### Field

- `key`: canonical, case-sensitive template key. Runtime matching is case-insensitive for user convenience.
- `label`: friendly UI name used in missing-field warnings.
- `type`: `string`, `date`, `string-list`, or `markdown`.
- `required`: whether absence prevents clean automatic export.
- `description`: what belongs in the field.
- `aliases`: optional accepted names for existing notes.

Canonical vocabulary:

| Concept | Key |
|---|---|
| Document title | `Title` |
| Short/running title | `ShortTitle` |
| Author or author list | `Author` |
| Institution/organization | `Affiliation` |
| Course | `Course` |
| Instructor | `Instructor` |
| Due/publication date | `DueDate` |
| Abstract | `Abstract` |
| Search keywords | `Keywords` |
| Author note | `AuthorNote` |
| Main Markdown | `Body` (derived; normally not frontmatter) |

### Option

Option keys use lower camel case and normally begin with a verb: `includeTitlePage`, `includeAbstract`, `includeAuthorNote`. A format’s saved settings store values by these keys.

### Rules

Rules express intent shared by exporters. Exporters are responsible for translating inches, points, line spacing, headers, page numbers, and pagination into each output type. If a new rule is necessary, update the TypeScript `PageRules` interface and every applicable exporter before using it in JSON.

### Sections

Sections provide semantic order and pagination hints. `key` should reuse a field key where appropriate. `Body` is reserved for the note’s Markdown body. Use the canonical section key `References` for a required source list, regardless of whether its rendered heading is References, Works Cited, or Bibliography. Source-list content belongs in the Markdown body under that heading, not in YAML.

### Variants

- `id`: stable lower-hyphen identifier within the parent format.
- `name`: user-facing paper-type name in template-creation and replacement workflows.
- `description`: explains the intended assignment or manuscript type.
- `recommendedSections`: ordered section names used when creating a new template.
- `abstractDefault`: whether this paper type normally includes an abstract in its recommended template structure. Instructor, institution, publisher, and journal requirements can override it.

Variants normally guide generated template outlines and are not shown in **Export in…**. Chicago 18 and AMA 11 are explicit exceptions because their citation-system and abstract-type choices materially affect exported content.

## Template contract

Every definition has a Markdown template. It must:

- begin with valid YAML frontmatter;
- include all required canonical metadata keys;
- include optional keys when they teach the expected structure;
- use YAML lists for `string-list` values;
- use ISO `YYYY-MM-DD` dates in examples;
- include a useful body outline without pretending placeholder prose is real content;
- contain a References section when the style uses references.

The exporter recognizes `## References`, `## Works Cited`, and `## Bibliography` as source-list headings. Legacy notes containing YAML `References` or `WorksCited` values remain supported, but new templates and format field definitions must not use those properties.

## AI procedure for adding a format

1. Identify the exact style and variant. Never merge materially different variants into vague optional switches.
2. Research the current primary organization documentation. If using an educational explainer, record that source and distinguish it from the owning organization.
3. List required metadata, optional metadata, section order, page rules, headings, references, tables, figures, and special cases.
4. Map concepts onto the canonical vocabulary. Add a new key only when no canonical key represents the concept.
5. Copy the closest existing JSON file; change every variant-specific fact.
6. Create the matching Markdown template.
7. Add the definition to `src/formats/index.ts` and defaults to `src/settings.ts`.
8. Update `formats.md` with status, paths, sources, and known exporter limitations.
9. Add validation and rendering tests.
10. Run `npm test`, `npm run lint`, and `npm run build`.

## Safety model for user formats

Future user-installed definitions should be loaded only after strict schema validation. Paths must remain inside an approved format directory; IDs and filenames must reject traversal; JSON must remain data-only; templates must be treated as text; and a malformed custom definition must be isolated without preventing built-in formats from loading.
