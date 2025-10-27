import * as assert from "node:assert";
import { describe, it } from "node:test";
import { patternMatches } from "../../src/lib.js";

describe("patternMatches", () => {
  describe("exact file paths", () => {
    it("should match exact paths with leading slash", () => {
      assert.ok(patternMatches("/src/config.ts", "src/config.ts"));
    });

    it("should not match different files", () => {
      assert.ok(!patternMatches("/src/config.ts", "src/other.ts"));
    });

    it("should not match partial paths", () => {
      assert.ok(!patternMatches("/src/config.ts", "src/config"));
    });
  });

  describe("directory patterns", () => {
    it("should match directory with trailing slash", () => {
      assert.ok(patternMatches("/src/", "src/file.ts"));
      assert.ok(patternMatches("/src/", "src/nested/file.ts"));
      assert.ok(patternMatches("/src/", "src/deeply/nested/file.ts"));
    });

    it("should not match files outside directory", () => {
      assert.ok(!patternMatches("/src/", "other/file.ts"));
      assert.ok(!patternMatches("/src/", "docs/file.ts"));
    });

    it("should match directory without trailing slash", () => {
      assert.ok(patternMatches("/src", "src/file.ts"));
      assert.ok(patternMatches("/src", "src/nested/file.ts"));
    });

    it("should handle root-level directories", () => {
      assert.ok(patternMatches("/docs/", "docs/README.md"));
      assert.ok(!patternMatches("/docs/", "src/docs/README.md"));
    });
  });

  describe("wildcard patterns", () => {
    it("should match any file with *", () => {
      assert.ok(patternMatches("*", "any-file.ts"));
      assert.ok(patternMatches("*", "README.md"));
      assert.ok(patternMatches("*", "nested/file.ts"));
    });

    it("should match file extensions", () => {
      assert.ok(patternMatches("*.md", "README.md"));
      assert.ok(patternMatches("*.md", "docs/guide.md"));
      assert.ok(patternMatches("*.ts", "src/file.ts"));
    });

    it("should not match different extensions", () => {
      assert.ok(!patternMatches("*.md", "README.txt"));
      assert.ok(!patternMatches("*.ts", "file.js"));
    });

    it("should match specific file patterns", () => {
      assert.ok(patternMatches("*.test.ts", "file.test.ts"));
      assert.ok(patternMatches("*.test.ts", "deep/nested/file.test.ts"));
    });
  });

  describe("double-star glob patterns", () => {
    it("should match with ** in path", () => {
      assert.ok(patternMatches("/src/**/*.ts", "src/file.ts"));
      assert.ok(patternMatches("/src/**/*.ts", "src/nested/file.ts"));
      assert.ok(patternMatches("/src/**/*.ts", "src/deeply/nested/file.ts"));
    });

    it("should respect path boundaries", () => {
      assert.ok(!patternMatches("/src/**/*.ts", "docs/file.ts"));
      assert.ok(!patternMatches("/src/**/*.ts", "file.ts"));
    });

    it("should match complex nested patterns", () => {
      assert.ok(patternMatches("/src/**/internal/**/*.ts", "src/api/internal/utils.ts"));
      assert.ok(
        patternMatches("/src/**/internal/**/*.ts", "src/frontend/components/internal/deep/file.ts"),
      );
    });

    it("should not match when required segment is missing", () => {
      assert.ok(!patternMatches("/src/**/internal/**/*.ts", "src/api/public/utils.ts"));
    });
  });

  describe("root-anchored patterns", () => {
    it("should match from root with leading slash", () => {
      assert.ok(patternMatches("/src/", "src/file.ts"));
    });

    it("should not match nested occurrence", () => {
      assert.ok(!patternMatches("/src/", "other/src/file.ts"));
    });

    it("should match root files", () => {
      assert.ok(patternMatches("/README.md", "README.md"));
    });

    it("should not match subdirectory files for root patterns", () => {
      assert.ok(!patternMatches("/README.md", "docs/README.md"));
    });
  });

  describe("non-root-anchored patterns", () => {
    it("should match anywhere in tree", () => {
      assert.ok(patternMatches("*.test.ts", "file.test.ts"));
      assert.ok(patternMatches("*.test.ts", "deep/nested/file.test.ts"));
    });

    it("should match directory patterns anywhere", () => {
      assert.ok(patternMatches(".github/", ".github/workflows/ci.yml"));
    });
  });

  describe("dot files and directories", () => {
    it("should match dot directories", () => {
      assert.ok(patternMatches(".github/", ".github/workflows/ci.yml"));
      assert.ok(patternMatches(".vscode/", ".vscode/settings.json"));
    });

    it("should match dot files", () => {
      assert.ok(patternMatches("*", ".gitignore"));
      assert.ok(patternMatches("*", ".env"));
    });

    it("should match specific dot file patterns", () => {
      assert.ok(patternMatches(".*.yml", ".eslintrc.yml"));
    });
  });

  describe("edge cases", () => {
    it("should handle patterns without leading slash", () => {
      assert.ok(patternMatches("src/", "src/file.ts"));
      assert.ok(patternMatches("src/api/", "src/api/endpoint.ts"));
    });

    it("should handle paths with backslashes (Windows)", () => {
      // Paths should be normalized to forward slashes
      assert.ok(patternMatches("/src/", "src\\file.ts"));
    });

    it("should match empty pattern segments correctly", () => {
      assert.ok(patternMatches("/src/**", "src/file.ts"));
      assert.ok(patternMatches("/src/**", "src/nested/file.ts"));
    });

    it("should handle patterns with dots", () => {
      assert.ok(patternMatches("*.config.js", "webpack.config.js"));
      assert.ok(patternMatches("*.config.js", "rollup.config.js"));
    });
  });

  describe("last match wins - pattern precedence", () => {
    it("should allow more specific patterns to override general ones", () => {
      const testPath = "src/api/auth/login.ts";

      // All these patterns would match in a CODEOWNERS file
      assert.ok(patternMatches("*", testPath));
      assert.ok(patternMatches("/src/", testPath));
      assert.ok(patternMatches("/src/api/", testPath));
      assert.ok(patternMatches("/src/api/auth/", testPath));
      // The last matching pattern in CODEOWNERS file would win
    });
  });
});
