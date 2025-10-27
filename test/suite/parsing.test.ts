import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { suite, test } from "mocha";
import { parseCodeOwners } from "../../src/lib";

suite("CODEOWNERS Parsing Test Suite", () => {
  // Resolve to source fixtures, not compiled output
  const fixturesPath = path.resolve(__dirname, "../../../test/fixtures");
  const codeownersPath = path.join(fixturesPath, "CODEOWNERS");

  test("Should parse CODEOWNERS file correctly", () => {
    const content = fs.readFileSync(codeownersPath, "utf8");
    const entries = parseCodeOwners(content);

    // Should have parsed multiple entries
    assert.ok(entries.length > 0, "Should have parsed entries");

    // Check that entries have correct structure
    for (const entry of entries) {
      assert.ok(entry.pattern, "Entry should have a pattern");
      assert.ok(Array.isArray(entry.owners), "Entry should have owners array");
      assert.ok(entry.owners.length > 0, "Entry should have at least one owner");
      assert.ok(
        typeof entry.line === "number" && entry.line > 0,
        "Entry should have a valid line number",
      );
    }
  });

  test("Should skip comment lines", () => {
    const content = "# Comment\n/src/ @team/eng\n# Another comment";
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 1, "Should only parse non-comment lines");
    assert.strictEqual(entries[0].pattern, "/src/");
    assert.strictEqual(entries[0].line, 2);
  });

  test("Should skip empty lines", () => {
    const content = "\n\n/src/ @team/eng\n\n";
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 1, "Should skip empty lines");
    assert.strictEqual(entries[0].pattern, "/src/");
    assert.strictEqual(entries[0].line, 3);
  });

  test("Should skip pattern-only lines without owners", () => {
    const content = "/src/ @team/eng\n/docs\n/test/ @team/qa";
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 2, "Should skip pattern-only lines");
    assert.strictEqual(entries[0].pattern, "/src/");
    assert.strictEqual(entries[1].pattern, "/test/");
  });

  test("Should handle multiple owners", () => {
    const content = "/src/ @team/eng @team/qa @team/devops";
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].owners.length, 3);
    assert.deepStrictEqual(entries[0].owners, ["@team/eng", "@team/qa", "@team/devops"]);
  });

  test("Should preserve correct line numbers", () => {
    const content = `# Line 1: comment
# Line 2: comment

/src/ @team/eng
/test/ @team/qa
# Line 6: comment
/docs/ @team/docs`;
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].line, 4, "First entry should be line 4");
    assert.strictEqual(entries[1].line, 5, "Second entry should be line 5");
    assert.strictEqual(entries[2].line, 7, "Third entry should be line 7");
  });

  test("Should handle various whitespace", () => {
    const content = "/src/   @team/eng    @team/qa";
    const entries = parseCodeOwners(content);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].pattern, "/src/");
    assert.strictEqual(entries[0].owners.length, 2);
  });

  test("Should parse complex patterns", () => {
    const content = fs.readFileSync(codeownersPath, "utf8");
    const entries = parseCodeOwners(content);

    // Check for specific patterns we know exist
    const wildcardEntry = entries.find((e) => e.pattern === "*");
    assert.ok(wildcardEntry, "Should have wildcard pattern");
    assert.deepStrictEqual(wildcardEntry.owners, ["@team/default"]);

    const apiAuthEntry = entries.find((e) => e.pattern === "/src/api/auth/");
    assert.ok(apiAuthEntry, "Should have nested directory pattern");

    const globEntry = entries.find((e) => e.pattern === "*.md");
    assert.ok(globEntry, "Should have glob pattern");
  });
});
