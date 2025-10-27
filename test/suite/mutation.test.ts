import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { suite, suiteSetup, suiteTeardown, test } from "mocha";
import { findOwnersForPath, parseCodeOwners } from "../../src/lib";

// Mutation tests - verify that line numbers stay accurate after file changes

suite("Mutation Test Suite", () => {
  // Resolve to source fixtures, not compiled output
  const fixturesPath = path.resolve(__dirname, "../../../test/fixtures");
  const mutationPath = path.join(fixturesPath, "CODEOWNERS_MUTATION");
  let originalContent: string;

  suiteSetup(() => {
    // Backup original content
    originalContent = fs.readFileSync(mutationPath, "utf8");
  });

  suiteTeardown(() => {
    // Restore original content
    fs.writeFileSync(mutationPath, originalContent, "utf8");
  });

  test("Should maintain line numbers after adding a new rule", () => {
    const content = fs.readFileSync(mutationPath, "utf8");
    const beforeEntries = parseCodeOwners(content);

    // Find existing entry line numbers
    const defaultEntry = beforeEntries.find((e) => e.pattern === "*");
    assert.ok(defaultEntry, "Should have default entry");
    const originalDefaultLine = defaultEntry.line;

    // Add a new rule at the end
    const newRule = "/src/new-file.ts @team/new";
    const modifiedContent = `${content}\n${newRule}`;
    fs.writeFileSync(mutationPath, modifiedContent, "utf8");

    // Re-parse
    const afterContent = fs.readFileSync(mutationPath, "utf8");
    const afterEntries = parseCodeOwners(afterContent);

    // Verify old entries kept their line numbers
    const defaultAfter = afterEntries.find((e) => e.pattern === "*");
    assert.ok(defaultAfter, "Should still have default entry");
    assert.strictEqual(
      defaultAfter.line,
      originalDefaultLine,
      "Original entry line number should not change",
    );

    // Verify new entry exists
    const newEntry = afterEntries.find((e) => e.pattern === "/src/new-file.ts");
    assert.ok(newEntry, "Should have new entry");
    assert.deepStrictEqual(newEntry.owners, ["@team/new"]);

    // Verify line numbers are accurate
    const lines = afterContent.split(/\r?\n/);
    const actualLine = lines[newEntry.line - 1].trim();
    assert.ok(
      actualLine.startsWith("/src/new-file.ts"),
      `Line ${newEntry.line} should contain the new pattern`,
    );
  });

  test("Should handle updating an existing rule", () => {
    // Reset file
    fs.writeFileSync(mutationPath, originalContent, "utf8");

    const beforeEntries = parseCodeOwners(originalContent);
    const appEntry = beforeEntries.find((e) => e.pattern === "/src/app.ts");
    assert.ok(appEntry, "Should have app.ts entry");
    const originalLine = appEntry.line;

    // Update the rule
    const lines = originalContent.split(/\r?\n/);
    lines[originalLine - 1] = "/src/app.ts @team/new-owner";
    const modifiedContent = lines.join("\n");
    fs.writeFileSync(mutationPath, modifiedContent, "utf8");

    // Re-parse
    const afterContent = fs.readFileSync(mutationPath, "utf8");
    const afterEntries = parseCodeOwners(afterContent);

    // Verify the entry was updated
    const updatedEntry = afterEntries.find((e) => e.pattern === "/src/app.ts");
    assert.ok(updatedEntry, "Should still have app.ts entry");
    assert.strictEqual(updatedEntry.line, originalLine, "Line number should stay the same");
    assert.deepStrictEqual(updatedEntry.owners, ["@team/new-owner"], "Owner should be updated");

    // Verify with actual file content
    const actualLines = afterContent.split(/\r?\n/);
    const actualLine = actualLines[updatedEntry.line - 1].trim();
    assert.ok(actualLine.includes("@team/new-owner"), "Actual line should contain new owner");
  });

  test("Should handle multiple mutations maintaining accuracy", () => {
    // Reset file
    fs.writeFileSync(mutationPath, originalContent, "utf8");

    // Add multiple new rules
    let content = fs.readFileSync(mutationPath, "utf8");
    content += "\n/src/file1.ts @team/one";
    content += "\n/src/file2.ts @team/two";
    content += "\n/src/file3.ts @team/three";
    fs.writeFileSync(mutationPath, content, "utf8");

    // Parse and verify
    const entries = parseCodeOwners(content);

    // Find all new entries
    const file1 = entries.find((e) => e.pattern === "/src/file1.ts");
    const file2 = entries.find((e) => e.pattern === "/src/file2.ts");
    const file3 = entries.find((e) => e.pattern === "/src/file3.ts");

    assert.ok(file1 && file2 && file3, "Should have all new entries");

    // Line numbers should be sequential
    assert.strictEqual(
      file2.line,
      file1.line + 1,
      "Sequential entries should have sequential line numbers",
    );
    assert.strictEqual(
      file3.line,
      file2.line + 1,
      "Sequential entries should have sequential line numbers",
    );

    // Verify each line is accurate
    const lines = content.split(/\r?\n/);
    assert.ok(lines[file1.line - 1].includes("/src/file1.ts"), "Line should match pattern");
    assert.ok(lines[file2.line - 1].includes("/src/file2.ts"), "Line should match pattern");
    assert.ok(lines[file3.line - 1].includes("/src/file3.ts"), "Line should match pattern");
  });

  test("Line navigation should work after mutation", () => {
    // Reset file
    fs.writeFileSync(mutationPath, originalContent, "utf8");

    // Add a new specific rule that will override existing
    const content = fs.readFileSync(mutationPath, "utf8");
    const newRule = "/src/utils/specific.ts @team/specific";
    const modifiedContent = `${content}\n${newRule}`;
    fs.writeFileSync(mutationPath, modifiedContent, "utf8");

    // Parse and find owner
    const entries = parseCodeOwners(modifiedContent);
    const match = findOwnersForPath("src/utils/specific.ts", entries);

    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/utils/specific.ts", "Should match specific rule");

    // Verify the line number points to correct location
    const lines = modifiedContent.split(/\r?\n/);
    const actualLine = lines[match.line - 1].trim();
    assert.strictEqual(actualLine, newRule, "Line number should point to exact rule");
    assert.ok(actualLine.includes(match.pattern), "Line should contain the pattern");
    assert.ok(actualLine.includes(match.owners[0]), "Line should contain the owner");
  });
});
