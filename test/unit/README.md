# Unit Tests

Fast, pure unit tests that run without VS Code.

## Running Tests

```bash
# Run unit tests only (fast)
pnpm test:unit

# Run integration tests only (slower, requires VS Code)
pnpm test

# Run all tests
pnpm test:all
```

## Test Files

- `parsing.test.ts` - Tests for `parseCodeOwners` function (12 tests)
- `matching.test.ts` - Tests for `patternMatches` function (29 tests)
- `lib.test.ts` - Tests for utility functions (26 tests)
  - `findOwnersForPath` - Find matching owner using last-match-wins rule
  - `extractAllTeams` - Extract unique teams from entries
  - `getTeamStats` - Count patterns per team
  - `isExactMatch` - Check if pattern is exact file match

## Why Unit Tests?

- **Fast**: Run in ~200ms without spawning VS Code
- **Pure**: Test business logic in isolation
- **Real Code**: Import actual production functions from `src/lib.ts`
- **No Mocks**: Test the real pattern matching and parsing logic

## What's Tested

### Parsing (`parseCodeOwners`)
- Basic CODEOWNERS syntax parsing
- Comment and empty line handling
- Multiple owners per pattern
- Line number tracking
- Edge cases (Windows line endings, emails, etc.)

### Pattern Matching (`patternMatches`)
- Exact file path matching
- Directory patterns (with/without trailing slash)
- Wildcard patterns (`*`, `**`)
- Root-anchored patterns (`/path`)
- Glob patterns
- Dot files and directories
- Windows path normalization

### Owner Resolution (`findOwnersForPath`)
- Last-match-wins rule application
- Exact file matches
- Directory pattern matching
- Glob pattern matching
- Fallback to default owners

### Team Utilities
- **`extractAllTeams`** - Unique team extraction, deduplication, sorting
- **`getTeamStats`** - Pattern count per team
- **`isExactMatch`** - Exact vs glob pattern detection

## Architecture

```
src/
  lib.ts          # Pure business logic (no VS Code deps)
  extension.ts    # VS Code extension code (imports from lib.ts)

test/
  unit/           # Fast unit tests (import from out/lib.js)
  suite/          # Integration tests (run in VS Code)
```

Unit tests import from the compiled `out/lib.js` which has no VS Code dependencies, allowing them to run in plain Node.js.

