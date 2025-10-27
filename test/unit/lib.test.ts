import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  extractAllTeams,
  findOwnersForPath,
  getTeamStats,
  isExactMatch,
  type OwnersMatch,
} from "../../src/lib.js";

describe("findOwnersForPath", () => {
  const entries: OwnersMatch[] = [
    { pattern: "*", owners: ["@team/default"], line: 1 },
    { pattern: "/src/", owners: ["@team/eng"], line: 2 },
    { pattern: "/src/api/", owners: ["@team/backend"], line: 3 },
    { pattern: "/src/api/auth/", owners: ["@team/security"], line: 4 },
    { pattern: "*.md", owners: ["@team/docs"], line: 5 },
    { pattern: "/src/config.ts", owners: ["@team/devops"], line: 6 },
  ];

  it("should find owner for exact file match", () => {
    const match = findOwnersForPath("src/config.ts", entries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "/src/config.ts");
    assert.deepStrictEqual(match.owners, ["@team/devops"]);
  });

  it("should find owner for directory match", () => {
    const match = findOwnersForPath("src/api/users.ts", entries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "/src/api/");
    assert.deepStrictEqual(match.owners, ["@team/backend"]);
  });

  it("should apply last match wins rule", () => {
    const match = findOwnersForPath("src/api/auth/login.ts", entries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "/src/api/auth/");
    assert.deepStrictEqual(match.owners, ["@team/security"]);
  });

  it("should match glob patterns", () => {
    const match = findOwnersForPath("README.md", entries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "*.md");
    assert.deepStrictEqual(match.owners, ["@team/docs"]);
  });

  it("should fall back to default wildcard", () => {
    const match = findOwnersForPath("random-file.xyz", entries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "*");
    assert.deepStrictEqual(match.owners, ["@team/default"]);
  });

  it("should return undefined when no match found", () => {
    const emptyEntries: OwnersMatch[] = [];
    const match = findOwnersForPath("any-file.ts", emptyEntries);
    assert.strictEqual(match, undefined);
  });

  it("should prefer more specific patterns (last match wins)", () => {
    const testEntries: OwnersMatch[] = [
      { pattern: "*.ts", owners: ["@team/typescript"], line: 1 },
      { pattern: "/src/**/*.ts", owners: ["@team/src"], line: 2 },
      { pattern: "/src/api/**/*.ts", owners: ["@team/api"], line: 3 },
    ];

    const match = findOwnersForPath("src/api/endpoint.ts", testEntries);
    assert.ok(match);
    assert.strictEqual(match.pattern, "/src/api/**/*.ts");
    assert.deepStrictEqual(match.owners, ["@team/api"]);
  });
});

describe("extractAllTeams", () => {
  it("should extract unique teams from entries", () => {
    const entries: OwnersMatch[] = [
      { pattern: "*", owners: ["@team/default"], line: 1 },
      { pattern: "/src/", owners: ["@team/eng", "@team/qa"], line: 2 },
      { pattern: "*.md", owners: ["@team/docs"], line: 3 },
      { pattern: "/api/", owners: ["@team/eng"], line: 4 }, // duplicate team
    ];

    const teams = extractAllTeams(entries);

    assert.deepStrictEqual(teams, ["@team/default", "@team/docs", "@team/eng", "@team/qa"]);
  });

  it("should return empty array for empty entries", () => {
    const teams = extractAllTeams([]);
    assert.deepStrictEqual(teams, []);
  });

  it("should sort teams alphabetically", () => {
    const entries: OwnersMatch[] = [
      { pattern: "*", owners: ["@zebra", "@alpha", "@beta"], line: 1 },
    ];

    const teams = extractAllTeams(entries);
    assert.deepStrictEqual(teams, ["@alpha", "@beta", "@zebra"]);
  });

  it("should handle email addresses as owners", () => {
    const entries: OwnersMatch[] = [
      { pattern: "*", owners: ["user@example.com", "@team/eng"], line: 1 },
      { pattern: "*.md", owners: ["docs@example.com"], line: 2 },
    ];

    const teams = extractAllTeams(entries);
    assert.deepStrictEqual(teams, ["@team/eng", "docs@example.com", "user@example.com"]);
  });

  it("should deduplicate teams across multiple patterns", () => {
    const entries: OwnersMatch[] = [
      { pattern: "/src/", owners: ["@team/eng"], line: 1 },
      { pattern: "/test/", owners: ["@team/eng", "@team/qa"], line: 2 },
      { pattern: "/docs/", owners: ["@team/qa"], line: 3 },
    ];

    const teams = extractAllTeams(entries);
    assert.deepStrictEqual(teams, ["@team/eng", "@team/qa"]);
  });
});

describe("getTeamStats", () => {
  it("should count patterns per team", () => {
    const entries: OwnersMatch[] = [
      { pattern: "*", owners: ["@team/default"], line: 1 },
      { pattern: "/src/", owners: ["@team/eng"], line: 2 },
      { pattern: "/test/", owners: ["@team/eng", "@team/qa"], line: 3 },
      { pattern: "*.md", owners: ["@team/docs"], line: 4 },
      { pattern: "/api/", owners: ["@team/eng"], line: 5 },
    ];

    const stats = getTeamStats(entries);

    assert.strictEqual(stats.get("@team/default"), 1);
    assert.strictEqual(stats.get("@team/eng"), 3);
    assert.strictEqual(stats.get("@team/qa"), 1);
    assert.strictEqual(stats.get("@team/docs"), 1);
  });

  it("should return empty map for empty entries", () => {
    const stats = getTeamStats([]);
    assert.strictEqual(stats.size, 0);
  });

  it("should count each occurrence when team appears multiple times in one pattern", () => {
    const entries: OwnersMatch[] = [
      { pattern: "/src/", owners: ["@team/eng", "@team/qa", "@team/eng"], line: 1 },
    ];

    const stats = getTeamStats(entries);
    assert.strictEqual(stats.get("@team/eng"), 2);
    assert.strictEqual(stats.get("@team/qa"), 1);
  });

  it("should handle patterns with multiple owners", () => {
    const entries: OwnersMatch[] = [
      { pattern: "/src/", owners: ["@team/eng", "@team/qa", "@team/devops"], line: 1 },
      { pattern: "/docs/", owners: ["@team/docs", "@team/qa"], line: 2 },
    ];

    const stats = getTeamStats(entries);
    assert.strictEqual(stats.get("@team/eng"), 1);
    assert.strictEqual(stats.get("@team/qa"), 2);
    assert.strictEqual(stats.get("@team/devops"), 1);
    assert.strictEqual(stats.get("@team/docs"), 1);
  });
});

describe("isExactMatch", () => {
  it("should return true for exact file path matches", () => {
    assert.ok(isExactMatch("/src/config.ts", "src/config.ts"));
    assert.ok(isExactMatch("src/config.ts", "src/config.ts"));
  });

  it("should return false for glob patterns", () => {
    assert.ok(!isExactMatch("*.ts", "file.ts"));
    assert.ok(!isExactMatch("/src/**/*.ts", "src/api/file.ts"));
    assert.ok(!isExactMatch("/src/*.ts", "src/file.ts"));
    assert.ok(!isExactMatch("src/[abc].ts", "src/a.ts"));
  });

  it("should return false when pattern contains wildcards", () => {
    assert.ok(!isExactMatch("*", "anything"));
    assert.ok(!isExactMatch("src/*", "src/file.ts"));
    assert.ok(!isExactMatch("src/**", "src/nested/file.ts"));
  });

  it("should return false when pattern contains question marks", () => {
    assert.ok(!isExactMatch("file?.ts", "file1.ts"));
    assert.ok(!isExactMatch("src/???.ts", "src/abc.ts"));
  });

  it("should return false when pattern contains brackets", () => {
    assert.ok(!isExactMatch("file[123].ts", "file1.ts"));
    assert.ok(!isExactMatch("[a-z].ts", "a.ts"));
  });

  it("should normalize leading slashes", () => {
    assert.ok(isExactMatch("/src/config.ts", "src/config.ts"));
    assert.ok(!isExactMatch("/src/config.ts", "other/config.ts"));
  });

  it("should return false for directory patterns", () => {
    assert.ok(!isExactMatch("/src/", "src/file.ts"));
    assert.ok(!isExactMatch("src/", "src"));
  });

  it("should return false when paths don't match", () => {
    assert.ok(!isExactMatch("/src/config.ts", "src/other.ts"));
    assert.ok(!isExactMatch("src/config.ts", "config.ts"));
    assert.ok(!isExactMatch("config.ts", "src/config.ts"));
  });

  it("should handle patterns without leading slash", () => {
    assert.ok(isExactMatch("README.md", "README.md"));
    assert.ok(!isExactMatch("README.md", "docs/README.md"));
  });

  it("should be case-sensitive", () => {
    assert.ok(!isExactMatch("/src/Config.ts", "src/config.ts"));
    assert.ok(isExactMatch("/src/Config.ts", "src/Config.ts"));
  });
});
