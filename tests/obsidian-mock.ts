export function getFrontMatterInfo(source: string): { exists: boolean; from: number; to: number; contentStart: number } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  return match ? { exists: true, from: 0, to: match[0].length - (match[0].endsWith("\n") ? 1 : 0), contentStart: match[0].length } : { exists: false, from: 0, to: 0, contentStart: 0 };
}

export function parseYaml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim();
    result[match[1]] = value === "''" || value === '""' ? "" : value.replace(/^['"]|['"]$/g, "");
  }
  return result;
}
