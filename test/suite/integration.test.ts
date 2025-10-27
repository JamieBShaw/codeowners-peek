import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { suite, suiteSetup, test } from "mocha";
import { findOwnersForPath, type OwnersMatch, parseCodeOwners } from "../../src/lib";

// Full integration tests that combine parsing and matching

suite("Integration Test Suite", () => {
  // Resolve to source fixtures, not compiled output
  const fixturesPath = path.resolve(__dirname, "../../../test/fixtures");
  const codeownersPath = path.join(fixturesPath, "CODEOWNERS");
  let entries: OwnersMatch[];

  suiteSetup(() => {
    const content = fs.readFileSync(codeownersPath, "utf8");
    entries = parseCodeOwners(content);
  });

  test("Should find owner for exact file match", () => {
    const match = findOwnersForPath("src/config.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/config.ts");
    assert.deepStrictEqual(match.owners, ["@team/devops"]);
  });

  test("Should find owner for directory match", () => {
    const match = findOwnersForPath("src/api/users.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/api/");
    assert.deepStrictEqual(match.owners, ["@team/backend"]);
  });

  test("Should apply last match wins rule", () => {
    // src/api/auth/login.ts matches:
    // 1. * -> @team/default
    // 2. /src/ -> @team/engineering
    // 3. /src/api/ -> @team/backend
    // 4. /src/api/auth/ -> @team/security
    // 5. /src/api/auth/login.ts -> @team/security @team/backend
    // Last one should win
    const match = findOwnersForPath("src/api/auth/login.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/api/auth/login.ts");
    assert.deepStrictEqual(match.owners, ["@team/security", "@team/backend"]);
  });

  test("Should handle multiple owners", () => {
    const match = findOwnersForPath("src/frontend/components/Button.tsx", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/frontend/components/");
    assert.strictEqual(match.owners.length, 2);
    assert.ok(match.owners.includes("@team/frontend"));
    assert.ok(match.owners.includes("@team/design"));
  });

  test("Should match glob patterns", () => {
    const match = findOwnersForPath("README.md", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "*.md");
    assert.deepStrictEqual(match.owners, ["@team/docs"]);
  });

  test("Should match nested glob patterns", () => {
    const match = findOwnersForPath("src/api/auth.test.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "*.test.ts");
    assert.deepStrictEqual(match.owners, ["@team/qa"]);
  });

  test("Should match complex glob with double-star", () => {
    const match = findOwnersForPath("src/api/internal/utils.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/**/internal/**/*.ts");
    assert.deepStrictEqual(match.owners, ["@team/core"]);
  });

  test("Should match directory without trailing slash", () => {
    const match = findOwnersForPath("scripts/build.sh", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/scripts");
    assert.deepStrictEqual(match.owners, ["@team/devops"]);
  });

  test("Should fall back to default owner", () => {
    const match = findOwnersForPath("random-file.xyz", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "*");
    assert.deepStrictEqual(match.owners, ["@team/default"]);
  });

  test("Should handle dot directories", () => {
    const match = findOwnersForPath(".github/workflows/ci.yml", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, ".github/");
    assert.deepStrictEqual(match.owners, ["@team/core"]);
  });

  test("Should match package directories", () => {
    const match = findOwnersForPath("packages/core/index.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/packages/core/");
    assert.deepStrictEqual(match.owners, ["@team/platform"]);
  });

  test("Should respect override for legacy file", () => {
    // /src/api/auth/legacy.ts should match the specific override,
    // not the general /src/api/auth/ pattern
    const match = findOwnersForPath("src/api/auth/legacy.ts", entries);
    assert.ok(match, "Should find match");
    assert.strictEqual(match.pattern, "/src/api/auth/legacy.ts");
    assert.deepStrictEqual(match.owners, ["@team/legacy"]);
  });

  test("Should preserve correct line numbers", () => {
    // Find a specific pattern and verify its line number
    const match = findOwnersForPath("src/config.ts", entries);
    assert.ok(match, "Should find match");
    assert.ok(match.line > 0, "Line number should be positive");

    // Verify by re-reading the file
    const content = fs.readFileSync(codeownersPath, "utf8");
    const lines = content.split(/\r?\n/);
    const actualLine = lines[match.line - 1];
    assert.ok(
      actualLine.includes(match.pattern),
      `Line ${match.line} should contain pattern ${match.pattern}`,
    );
    assert.ok(
      actualLine.includes(match.owners[0]),
      `Line ${match.line} should contain owner ${match.owners[0]}`,
    );
  });

  test("Line numbers should be accurate across multiple matches", () => {
    // Test several matches and verify their line numbers
    const testCases = [
      { path: "src/api/auth/login.ts", pattern: "/src/api/auth/login.ts" },
      { path: "README.md", pattern: "*.md" },
      { path: "src/config.ts", pattern: "/src/config.ts" },
    ];

    const content = fs.readFileSync(codeownersPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const testCase of testCases) {
      const match = findOwnersForPath(testCase.path, entries);
      assert.ok(match, `Should find match for ${testCase.path}`);
      assert.strictEqual(
        match.pattern,
        testCase.pattern,
        `Pattern should match for ${testCase.path}`,
      );

      const actualLine = lines[match.line - 1].trim();
      assert.ok(
        actualLine.startsWith(match.pattern),
        `Line ${match.line} should start with pattern ${match.pattern}, got: ${actualLine}`,
      );
    }
  });
});
