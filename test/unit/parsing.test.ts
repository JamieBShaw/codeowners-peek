import * as assert from "node:assert";
import { describe, it } from "node:test";
import { parseCodeOwners } from "../../src/lib.js";

describe("parseCODEOWNERS", () => {
  it("should parse a simple CODEOWNERS entry", () => {
    const content = "/src/ @team/eng";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].pattern, "/src/");
    assert.deepStrictEqual(result[0].owners, ["@team/eng"]);
    assert.strictEqual(result[0].line, 1);
  });

  it("should skip comment lines", () => {
    const content = `# This is a comment
/src/ @team/eng
# Another comment`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].pattern, "/src/");
    assert.strictEqual(result[0].line, 2);
  });

  it("should skip empty lines", () => {
    const content = `

/src/ @team/eng

/docs/ @team/docs`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].line, 3);
    assert.strictEqual(result[1].line, 5);
  });

  it("should skip lines without owners", () => {
    const content = `/src/ @team/eng
/docs
/test/ @team/qa`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].pattern, "/src/");
    assert.strictEqual(result[1].pattern, "/test/");
  });

  it("should handle multiple owners", () => {
    const content = "/src/ @team/eng @team/qa @team/devops";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].owners.length, 3);
    assert.deepStrictEqual(result[0].owners, ["@team/eng", "@team/qa", "@team/devops"]);
  });

  it("should handle various whitespace", () => {
    const content = "/src/   @team/eng    @team/qa";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].pattern, "/src/");
    assert.strictEqual(result[0].owners.length, 2);
  });

  it("should preserve accurate line numbers", () => {
    const content = `# Comment line 1
# Comment line 2

/src/ @team/eng
/test/ @team/qa
# Another comment
/docs/ @team/docs`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].line, 4);
    assert.strictEqual(result[1].line, 5);
    assert.strictEqual(result[2].line, 7);
  });

  it("should handle glob patterns", () => {
    const content = `*.md @team/docs
**/*.test.ts @team/qa
/src/**/*.ts @team/eng`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].pattern, "*.md");
    assert.strictEqual(result[1].pattern, "**/*.test.ts");
    assert.strictEqual(result[2].pattern, "/src/**/*.ts");
  });

  it("should handle Windows line endings", () => {
    const content = "/src/ @team/eng\r\n/docs/ @team/docs\r\n";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].pattern, "/src/");
    assert.strictEqual(result[1].pattern, "/docs/");
  });

  it("should handle email addresses as owners", () => {
    const content = "/src/ user@example.com @team/eng";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].owners, ["user@example.com", "@team/eng"]);
  });

  it("should handle empty content", () => {
    const content = "";
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 0);
  });

  it("should handle content with only comments", () => {
    const content = `# Comment 1
# Comment 2
# Comment 3`;
    const result = parseCodeOwners(content);

    assert.strictEqual(result.length, 0);
  });
});
