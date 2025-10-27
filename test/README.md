# Integration Tests

This directory contains comprehensive integration tests for the CODEOWNERS Peek extension.

## Test Structure

### Fixtures (`fixtures/`)
- `CODEOWNERS` - Test file with various patterns including:
  - Exact file matches
  - Directory patterns (with/without trailing slash)
  - Glob patterns (`*.md`, `*.test.ts`)
  - Complex double-star patterns (`/src/**/internal/**/*.ts`)
  - Multiple owners
  - Pattern-only lines (should be skipped)
  - Last match wins scenarios
  
- `CODEOWNERS_MUTATION` - Test file for mutation tests (gets modified and restored)

### Test Suites (`suite/`)

#### `parsing.test.ts`
Tests the CODEOWNERS file parsing logic:
- Correctly parses patterns and owners
- Skips comments and empty lines
- Skips pattern-only lines without owners
- Handles multiple owners
- Preserves accurate line numbers
- Handles various whitespace

#### `matching.test.ts`
Tests pattern matching logic:
- Exact file path matches
- Directory patterns (with/without trailing slash)
- Wildcard patterns (`*`)
- Glob extension patterns (`*.md`)
- Double-star patterns (`/src/**/*.test.ts`)
- Root-anchored vs relative patterns
- Complex nested patterns
- Dot files and directories

#### `integration.test.ts`
Full integration tests combining parsing and matching:
- Finding owners for various file paths
- Last match wins rule
- Multiple owners handling
- Glob pattern precedence
- Override patterns
- Line number accuracy verification
- Real-world scenarios

#### `mutation.test.ts`
Tests file mutation scenarios:
- Adding new rules at the end
- Updating existing rules
- Multiple sequential mutations
- Line number accuracy after mutations
- Navigation to correct line after changes

## Running Tests

```bash
# Install dependencies
pnpm install

# Run all tests (integration + unit)
pnpm test

# Compile and watch
pnpm watch
```

## Test Coverage

The tests cover:
- ✅ Parsing edge cases
- ✅ Pattern matching accuracy
- ✅ Last match wins behavior
- ✅ Line number preservation
- ✅ File mutation scenarios
- ✅ Multiple owner handling
- ✅ Glob patterns (simple and complex)
- ✅ Directory matching
- ✅ Pattern precedence rules

## Key Test Scenarios

### Edge Cases Tested
1. **Pattern-only lines** - Lines with just a pattern and no owners are skipped
2. **Comments and empty lines** - Properly ignored during parsing
3. **Line number accuracy** - Verified line numbers match actual file content
4. **Mutation stability** - Line numbers remain accurate after file modifications
5. **Last match wins** - Most specific pattern takes precedence
6. **Multiple owners** - Correctly parsed and returned
7. **Trailing slashes** - Directories match with or without trailing slash
8. **Root anchoring** - Leading `/` patterns match from root only

### Real-World Scenarios
- Authentication files owned by security team but overridden for legacy files
- Frontend components with multiple team ownership
- Glob patterns for documentation and test files
- Internal/core files with restricted ownership
- Package directory ownership hierarchy

