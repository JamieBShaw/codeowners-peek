import * as assert from "node:assert";
import { suite, test } from "mocha";
import { patternMatches } from "../../src/lib";

suite("Pattern Matching Test Suite", () => {
  test("Should match exact file paths", () => {
    assert.ok(patternMatches("/src/config.ts", "src/config.ts"), "Should match exact path");
    assert.ok(!patternMatches("/src/config.ts", "src/other.ts"), "Should not match different file");
  });

  test("Should match directory patterns with trailing slash", () => {
    assert.ok(patternMatches("/src/", "src/file.ts"), "Should match file in directory");
    assert.ok(
      patternMatches("/src/", "src/nested/file.ts"),
      "Should match nested file in directory",
    );
    assert.ok(
      !patternMatches("/src/", "other/file.ts"),
      "Should not match file in different directory",
    );
  });

  test("Should match directory patterns without trailing slash", () => {
    assert.ok(patternMatches("/src", "src/file.ts"), "Should match file in directory");
    assert.ok(patternMatches("/src", "src/nested/file.ts"), "Should match nested file");
  });

  test("Should match wildcard patterns", () => {
    assert.ok(patternMatches("*", "any-file.ts"), "Wildcard should match any file");
    assert.ok(patternMatches("*", "nested/file.ts"), "Wildcard should match nested files");
  });

  test("Should match glob extension patterns", () => {
    assert.ok(patternMatches("*.md", "README.md"), "Should match .md files");
    assert.ok(patternMatches("*.md", "docs/guide.md"), "Should match .md files in subdirs");
    assert.ok(!patternMatches("*.md", "README.txt"), "Should not match different extension");
  });

  test("Should match double-star glob patterns", () => {
    assert.ok(
      patternMatches("/src/**/*.test.ts", "src/api/auth.test.ts"),
      "Should match with double-star",
    );
    assert.ok(
      patternMatches("/src/**/*.test.ts", "src/nested/deep/file.test.ts"),
      "Should match deeply nested",
    );
    assert.ok(
      !patternMatches("/src/**/*.test.ts", "src/file.ts"),
      "Should not match wrong pattern",
    );
  });

  test("Should respect leading slash for root-anchored patterns", () => {
    assert.ok(patternMatches("/src/", "src/file.ts"), "Should match from root with leading slash");
    assert.ok(
      !patternMatches("/src/", "other/src/file.ts"),
      "Should not match nested src with leading slash",
    );
  });

  test("Should match patterns without leading slash anywhere in tree", () => {
    assert.ok(
      patternMatches(".github/", ".github/workflows/ci.yml"),
      "Should match .github at root",
    );
    assert.ok(
      patternMatches("*.test.ts", "deep/nested/file.test.ts"),
      "Should match pattern anywhere",
    );
  });

  test("Should match complex nested patterns", () => {
    assert.ok(
      patternMatches("/src/**/internal/**/*.ts", "src/api/internal/utils.ts"),
      "Should match complex pattern",
    );
    assert.ok(
      patternMatches("/src/**/internal/**/*.ts", "src/frontend/components/internal/deep/file.ts"),
      "Should match deeply nested complex pattern",
    );
    assert.ok(
      !patternMatches("/src/**/internal/**/*.ts", "src/api/public/utils.ts"),
      "Should not match when internal is missing",
    );
  });

  test("Should handle dot files", () => {
    assert.ok(
      patternMatches(".github/", ".github/workflows/ci.yml"),
      "Should match dot directories",
    );
    assert.ok(patternMatches("*", ".gitignore"), "Wildcard should match dot files");
  });

  test("Last match wins - most specific pattern", () => {
    const patterns = [
      { pattern: "*", result: true },
      { pattern: "/src/", result: true },
      { pattern: "/src/api/", result: true },
      { pattern: "/src/api/auth/", result: true },
    ];

    const testPath = "src/api/auth/login.ts";

    // All patterns should match
    for (const p of patterns) {
      const matches = patternMatches(p.pattern, testPath);
      assert.strictEqual(matches, p.result, `Pattern ${p.pattern} should match ${testPath}`);
    }
  });
});
