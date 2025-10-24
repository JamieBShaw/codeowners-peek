<div align="center">

![Codeowners Peek Banner](./assets/banner-1280x640-light.png)

# Codeowners Peek

**Instantly see who owns the code you're reading**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/JamieBShaw/codeowners-peek)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](./LICENSE)
[![GitHub](https://img.shields.io/github/stars/JamieBShaw/codeowners-peek?style=social)](https://github.com/JamieBShaw/codeowners-peek)

</div>

---

**Codeowners Peek** is a lightweight Cursor/VS Code extension that surfaces CODEOWNERS for the currently focused file—in a small status bar item, CodeLens at the top of files, and via command palette actions. It parses your repository's CODEOWNERS file, applies GitHub's "last match wins" rule, and shows the resolved owners instantly.

## Why Use This?

### 🚀 Faster "Who owns this?"
Get immediate visibility of responsible teams/handles while reading code—no context switch to search through CODEOWNERS.

### 👀 Default Owner Visibility
If no rule matches, the extension surfaces the default owner (e.g., `* → @yourteam/leads`). This makes gaps obvious and helps avoid orphaned files.

### 🧹 Drives Hygiene of CODEOWNERS
Seeing "none" or a default owner at a glance prompts additions and cleanup where ownership is unclear or outdated.

### 💬 Better Routing for Questions & Reviews
Engineers can ping the right team early (in Slack or as PR reviewers) and avoid bouncing issues or slow reviews.

### 🎯 Low-Friction, Always-On Signal
The status bar is subtle but always there; commands show the pattern and line number for quick "why did this match?" checks.

## Features

### 📊 Status Bar Integration
See the owners of the active file at a glance in your status bar.

- Click the status bar item to see full details
- Shows "none" or default team if no match found
- Updates automatically as you switch files

### 🔍 CodeLens
Get ownership information right at the top of each file with an inline CodeLens.

- Shows owners with a 👥 icon
- Click to see full details
- Can be toggled on/off in settings

### 🎯 Command Palette Actions

#### `CODEOWNERS: Show Owners for File`
Shows a notification with:
- The file path (relative to workspace)
- Owner(s) (teams or handles)
- The matching pattern from CODEOWNERS
- Line number in the CODEOWNERS file
- Quick actions: **Open CODEOWNERS** (jumps to the exact line), **Copy Owners**, or **Close**

#### `CODEOWNERS: Copy Owners`
One-click copy of the owners to your clipboard—perfect for pasting into Slack or PR descriptions.

### 🔄 Auto-Refresh
The extension watches your CODEOWNERS file and automatically reloads when it changes. No need to restart VS Code after updating ownership rules.

### ⚡ Performance
- Results are cached for 30 seconds to minimize file system access
- Lightweight parsing with minimal overhead
- No impact on editor performance

## Installation

### From VSIX (Local Development)
1. Download the `.vsix` file
2. In VS Code: `Extensions` → `…` menu → `Install from VSIX...`
3. Select the downloaded `.vsix` file
4. Reload VS Code when prompted

### From Marketplace (Coming Soon)
Search for "Codeowners Peek" in the Extensions marketplace and click Install.

## Usage

### Quick Start

1. **Open a file** in a workspace that has a `CODEOWNERS` file
2. **Look at the status bar** (bottom left) to see the owners: `👤 @team/owners`
3. **Click the status bar item** or run **"CODEOWNERS: Show Owners for File"** from the command palette to see:
   - Full owner list
   - Matching pattern (e.g., `src/api/**`)
   - Line number in CODEOWNERS
4. **Click "Open CODEOWNERS"** to jump directly to the matching line
5. **Click "Copy Owners"** to copy them to clipboard

### Supported CODEOWNERS Locations

The extension searches for CODEOWNERS in the following locations (in order):
- `CODEOWNERS` (root)
- `.github/CODEOWNERS`
- `docs/CODEOWNERS`
- `.gitlab/CODEOWNERS`

You can customize this search order in settings.

### Pattern Matching

Codeowners Peek implements GitHub's CODEOWNERS pattern matching rules:

- **Last match wins**: If multiple patterns match, the last one in the file takes precedence
- **Glob patterns**: Supports `*`, `**`, `?`, and `[...]` wildcards
- **Root-anchored paths**: Patterns starting with `/` match from the repository root
- **Directory patterns**: Patterns ending with `/` match the directory and all its contents
- **Path prefixes**: Non-glob patterns match as prefixes (e.g., `docs` matches `docs/api/README.md`)

## Configuration

Open your VS Code settings and search for "Codeowners" to customize:

```jsonc
{
  // Search order for CODEOWNERS files from workspace root
  "codeowners.path": [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
    ".gitlab/CODEOWNERS"
  ],

  // Show owners in the status bar (default: true)
  "codeowners.enableStatusBar": true,

  // Show a CodeLens with owners at the top of files (default: true)
  "codeowners.enableCodeLens": true,

  // Show ownership badges in the Explorer (default: true, coming soon)
  "codeowners.enableExplorerBadges": true
}
```

## How It Works

1. **On activation**, the extension searches for a CODEOWNERS file in your workspace
2. **It parses** all ownership rules into an indexed format
3. **For each file** you open, it matches the file path against all patterns
4. **The last matching rule** determines the owner (following GitHub's "last match wins" behavior)
5. **Results are cached** for 30 seconds to improve performance
6. **When CODEOWNERS changes**, the cache is cleared and rules are reloaded

### Matching Algorithm

```typescript
// Example patterns and what they match:
"*.ts"              → All TypeScript files anywhere
"/src/*"            → Files directly in /src
"src/**/*.ts"       → All TypeScript files in src/ recursively
"docs/"             → Everything in docs/ directory
"backend"           → Files/dirs starting with "backend"
```

## Impact & Benefits

### For Engineers
- **Reduce context switching**: Know immediately who to ask without searching
- **Faster PR workflows**: Tag the right reviewers from the start
- **Learn ownership**: Understand which teams own different parts of the codebase

### For Managers
- **Reduce PR review latency**: Fewer misrouted PRs → faster first response
- **Lower triage overhead**: Less time spent tracking down owners in Slack or code search
- **Encourage ownership clarity**: Visible gaps motivate teams to add/update patterns
- **Track metrics**: Monitor % of files with specific vs. default owners over time

## Known Limitations

- **Single workspace root**: Multi-root workspaces are not yet supported (uses the first workspace folder)
- **Read-only**: The extension doesn't edit CODEOWNERS—it only reads and points to lines
- **Pattern edge cases**: Matching mirrors GitHub behavior, but unusual edge cases may need tuning
- **Explorer badges**: Currently not implemented due to VS Code API limitations (on roadmap)

## Roadmap

### Near-term (High Value, Low Effort)
- [x] Copy owners command (one-click clipboard) ✅ **Done**
- [x] Jump to matching line in CODEOWNERS ✅ **Done**
- [x] Auto-refresh on CODEOWNERS changes ✅ **Done**
- [x] CodeLens integration ✅ **Done**
- [ ] Explorer badges: show owners as tooltip/badge in file tree
- [ ] Settings UI: configure which features are enabled

### Medium-term
- [ ] Map team handles → Slack channels or on-call docs
- [ ] Multi-root workspace support
- [ ] Ownership statistics dashboard
- [ ] Hover provider for inline pattern documentation

### Long-term
- [ ] Suggest CODEOWNERS patterns for unclaimed files
- [ ] Integration with PR review assignment
- [ ] Team directory integration
- [ ] Historical ownership tracking

## Success Metrics

Track these to measure impact:

- **Ownership coverage**: % of files with specific owners vs. default owner
- **PR routing efficiency**: Time-to-first-review before/after adoption
- **CODEOWNERS hygiene**: Number of new/updated entries per week
- **Usage**: Command invocations, files checked per day

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)

### Setup

```bash
# Clone the repository
git clone https://github.com/JamieBShaw/codeowners-peek.git
cd codeowners-peek

# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Watch for changes (during development)
pnpm run watch
```

### Testing Locally

1. Open this folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Open a workspace with a CODEOWNERS file
4. Test the features!

### Building VSIX

```bash
# Package the extension
pnpm vsce package

# This creates codeowners-peek-1.0.0.vsix
```

### Code Quality

```bash
# Format code
pnpm run format

# Lint code
pnpm run lint

# Run all checks (lint + format)
pnpm run check
```

This project uses [Biome](https://biomejs.dev/) for fast, modern linting and formatting.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and linting (`pnpm run check`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Areas for Contribution

- **Pattern matching edge cases**: Help identify and fix unusual matching scenarios
- **Performance improvements**: Optimize caching and parsing strategies
- **Documentation**: Improve examples, add screenshots, create tutorials
- **Tests**: Add unit and integration tests
- **Features from roadmap**: Pick any item from the roadmap above!

## Tech Stack

- **TypeScript** - Type-safe extension development
- **pnpm** - Fast, disk-space-efficient package management
- **Biome** - Lightning-fast linting and formatting
- **minimatch** - Glob pattern matching (battle-tested, widely used)
- **VS Code Extension API** - Native integration with editor features

## License

ISC

## Author

Jamie Shaw

---

## Feedback & Support

Found a bug? Have a feature request? Want to share how you're using this?

Open an issue or discussion on your repository's GitHub page.

---

<p align="center">
  Made with ❤️ for better code ownership
</p>

