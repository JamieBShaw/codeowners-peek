import * as fs from "node:fs";
import * as path from "node:path";
import { type MinimatchOptions, minimatch } from "minimatch";
import * as vscode from "vscode";

type OwnersMatch = { pattern: string; owners: string[]; line: number };

let codeownersIndex: { file?: string; entries: OwnersMatch[] } = { entries: [] };
let statusItem: vscode.StatusBarItem;
const fileCache = new Map<string, { match: OwnersMatch | undefined; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function activate(context: vscode.ExtensionContext) {
  // Check if status bar is enabled
  const config = vscode.workspace.getConfiguration("codeowners");
  const enableStatusBar = config.get<boolean>("enableStatusBar", true);

  if (enableStatusBar) {
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5);
    statusItem.text = "$(account) loading owners…";
    statusItem.tooltip = "CODEOWNERS for active file - Click to show details";
    statusItem.command = "codeowners.peek";
    statusItem.show();
    context.subscriptions.push(statusItem);
  }

  const disposable = vscode.commands.registerCommand("codeowners.peek", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Open a file to check owners.");
      return;
    }

    await ensureIndexLoaded();

    const root = workspaceRoot();
    if (!root) {
      vscode.window.showInformationMessage("No workspace folder.");
      return;
    }

    const rel = path.relative(root, editor.document.uri.fsPath).replace(/\\/g, "/");

    if (!codeownersIndex.file) {
      vscode.window.showInformationMessage("No CODEOWNERS file found in this workspace.");
      return;
    }

    const match = ownersFor(rel);
    if (!match) {
      vscode.window.showInformationMessage(`No CODEOWNERS match for: ${rel}`);
      return;
    }

    const message = `File: ${rel}\nOwners: ${match.owners.join(", ")}\nPattern: ${match.pattern} (line ${match.line})`;

    const actions = ["Open CODEOWNERS", "Copy Owners", "Close"];

    const selection = await vscode.window.showInformationMessage(message, ...actions);

    if (selection === "Open CODEOWNERS" && codeownersIndex.file) {
      const doc = await vscode.workspace.openTextDocument(codeownersIndex.file);
      const editor = await vscode.window.showTextDocument(doc);
      const position = new vscode.Position(match.line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    } else if (selection === "Copy Owners") {
      await vscode.env.clipboard.writeText(match.owners.join(", "));
      vscode.window.showInformationMessage("Owners copied to clipboard");
    }
  });

  context.subscriptions.push(disposable);

  // Add copy owners command
  const copyDisposable = vscode.commands.registerCommand("codeowners.copyOwners", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Open a file to check owners.");
      return;
    }

    await ensureIndexLoaded();

    const root = workspaceRoot();
    if (!root) {
      vscode.window.showInformationMessage("No workspace folder.");
      return;
    }

    const rel = path.relative(root, editor.document.uri.fsPath).replace(/\\/g, "/");

    if (!codeownersIndex.file) {
      vscode.window.showInformationMessage("No CODEOWNERS file found in this workspace.");
      return;
    }

    const match = ownersFor(rel);
    if (!match) {
      vscode.window.showInformationMessage(`No CODEOWNERS match for: ${rel}`);
      return;
    }

    await vscode.env.clipboard.writeText(match.owners.join(", "));
    vscode.window.showInformationMessage(`Copied owners: ${match.owners.join(", ")}`);
  });

  context.subscriptions.push(copyDisposable);

  // Add CodeLens provider
  const enableCodeLens = config.get<boolean>("enableCodeLens", true);
  if (enableCodeLens) {
    const codeLensProvider = new CodeLensProvider();
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "file" }, codeLensProvider),
    );
  }

  // Note: Explorer badges require VS Code 1.60+ and may need different API
  // For now, we'll skip this feature to avoid API compatibility issues

  // update footer when switching editors or saving
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateFooter()),
    vscode.workspace.onDidSaveTextDocument(() => updateFooter()),
  );

  // Watch for CODEOWNERS file changes
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (codeownersIndex.file && document.uri.fsPath === codeownersIndex.file) {
        // Reload CODEOWNERS when it's saved
        codeownersIndex = { entries: [] };
        fileCache.clear(); // Clear cache when CODEOWNERS changes
        ensureIndexLoaded().then(() => updateFooter());
      }
    }),
  );

  updateFooter();
}

export function deactivate() {}

class CodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const root = workspaceRoot();
    if (!root) return [];

    await ensureIndexLoaded();
    if (!codeownersIndex.file) return [];

    const rel = path.relative(root, document.uri.fsPath).replace(/\\/g, "/");
    const match = ownersFor(rel);

    if (!match) return [];

    const range = new vscode.Range(0, 0, 0, 0);
    const codeLens = new vscode.CodeLens(range, {
      title: `👥 ${match.owners.join(", ")}`,
      command: "codeowners.peek",
      arguments: [],
    });

    return [codeLens];
  }
}

// Explorer badge provider removed due to API compatibility issues
// This feature can be re-implemented when the correct API is available

async function updateFooter() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusItem.text = "$(account) No file";
    return;
  }

  const root = workspaceRoot();
  if (!root) {
    statusItem.text = "$(account) No workspace";
    return;
  }

  await ensureIndexLoaded();
  const rel = path.relative(root, editor.document.uri.fsPath).replace(/\\/g, "/");
  const match = ownersFor(rel);

  if (!codeownersIndex.file) {
    statusItem.text = "$(account) No CODEOWNERS";
    return;
  }

  if (!match) {
    statusItem.text = "$(account) none";
    statusItem.tooltip = `No match in ${path.basename(codeownersIndex.file)}`;
    return;
  }

  statusItem.text = `$(account) ${match.owners.join(", ")}`;
  statusItem.tooltip = `Pattern: ${match.pattern}\nFile: ${path.basename(codeownersIndex.file)} (line ${match.line})`;
}

/* ---------- helpers ---------- */

function workspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

async function ensureIndexLoaded() {
  if (codeownersIndex.entries.length > 0) return;

  const root = workspaceRoot();
  if (!root) return;

  // Get custom CODEOWNERS paths from configuration
  const config = vscode.workspace.getConfiguration("codeowners");
  const candidates = config.get<string[]>("path", [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
    ".gitlab/CODEOWNERS",
  ]);

  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const content = fs.readFileSync(abs, "utf8");
      codeownersIndex = { file: abs, entries: parseCODEOWNERS(content) };
      break;
    }
  }
}

function parseCODEOWNERS(content: string): OwnersMatch[] {
  const lines = content.split(/\r?\n/);
  const out: OwnersMatch[] = [];
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return;
    const pattern = parts[0];
    const owners = parts.slice(1);
    out.push({ pattern, owners, line: idx + 1 });
  });
  return out;
}

function ownersFor(relPathFromRoot: string): OwnersMatch | undefined {
  // Check cache first
  const cached = fileCache.get(relPathFromRoot);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.match;
  }

  let winner: OwnersMatch | undefined;
  for (const e of codeownersIndex.entries) {
    if (patternMatches(e.pattern, relPathFromRoot)) winner = e; // last match wins
  }

  // Cache the result
  fileCache.set(relPathFromRoot, { match: winner, timestamp: Date.now() });
  return winner;
}

function patternMatches(pattern: string, relPath: string): boolean {
  const p = relPath.replace(/\\/g, "/");
  let pat = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  const opts: MinimatchOptions = { dot: true, nocase: false, nocomment: true };

  // If pattern ends with "/", treat as "this dir and everything inside"
  if (pat.endsWith("/")) {
    pat = `${pat}**`;
  }

  // If no glob chars, treat as path prefix (directory) or exact file
  const hasGlob = /[*?[\]]/.test(pat);
  if (!hasGlob) {
    const norm = pat.startsWith("/") ? pat.slice(1) : pat;
    return p === norm || p.startsWith(norm.endsWith("/") ? norm : `${norm}/`);
  }

  if (pat.startsWith("/")) {
    return minimatch(`/${p}`, pat, opts);
  } else {
    return minimatch(p, pat, opts) || minimatch(p, `**/${pat}`, opts);
  }
}
