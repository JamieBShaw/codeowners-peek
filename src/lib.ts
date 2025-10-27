import { type MinimatchOptions, minimatch } from "minimatch";

export type OwnersMatch = { pattern: string; owners: string[]; line: number };

export function parseCodeOwners(content: string): OwnersMatch[] {
  const lines = content.split(/\r?\n/);
  const out: OwnersMatch[] = [];
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return;
    const pattern = parts[0];
    const owners = parts.slice(1);
    out.push({ pattern, owners, line: idx + 1 });
  });
  return out;
}

export function patternMatches(pattern: string, relPath: string): boolean {
  const p = relPath.replace(/\\/g, "/");
  let pat = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  const opts: MinimatchOptions = { dot: true, nocase: false, nocomment: true };

  // If pattern ends with "/", treat as "this dir and everything inside"
  if (pat.endsWith("/")) {
    pat = `${pat}**`;
  }

  // If no glob chars, treat as path prefix (directory) or exact file
  const hasGlob = /[*?[\]]/.test(pat);
  if (!hasGlob) {
    const norm = pat.startsWith("/") ? pat.slice(1) : pat;
    return p === norm || p.startsWith(norm.endsWith("/") ? norm : `${norm}/`);
  }

  if (pat.startsWith("/")) {
    return minimatch(`/${p}`, pat, opts);
  }
  return minimatch(p, pat, opts) || minimatch(p, `**/${pat}`, opts);
}

/**
 * Find the matching owner for a file path using "last match wins" rule
 */
export function findOwnersForPath(
  relPathFromRoot: string,
  entries: OwnersMatch[],
): OwnersMatch | undefined {
  let winner: OwnersMatch | undefined;
  for (const entry of entries) {
    if (patternMatches(entry.pattern, relPathFromRoot)) {
      winner = entry; // last match wins
    }
  }
  return winner;
}

/**
 * Extract all unique teams/owners from CODEOWNERS entries
 */
export function extractAllTeams(entries: OwnersMatch[]): string[] {
  const teams = new Set<string>();
  for (const entry of entries) {
    for (const owner of entry.owners) {
      teams.add(owner);
    }
  }
  return Array.from(teams).sort();
}

/**
 * Get statistics about how many patterns each team/owner appears in
 */
export function getTeamStats(entries: OwnersMatch[]): Map<string, number> {
  const stats = new Map<string, number>();
  for (const entry of entries) {
    for (const owner of entry.owners) {
      stats.set(owner, (stats.get(owner) || 0) + 1);
    }
  }
  return stats;
}

/**
 * Check if a pattern is an exact file match (not a glob pattern)
 */
export function isExactMatch(pattern: string, filePath: string): boolean {
  // Remove leading slash for comparison
  const normalizedPattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;

  // If pattern has glob characters, it's not exact
  if (/[*?[\]]/.test(pattern)) {
    return false;
  }

  // Check if the pattern matches the file path exactly
  return normalizedPattern === filePath;
}
