import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  extractAllTeams,
  findOwnersForPath,
  getTeamStats,
  isExactMatch,
  type OwnersMatch,
  parseCodeOwners,
} from "./lib";

let codeownersIndex: { file?: string; entries: OwnersMatch[] } = { entries: [] };
let statusItem: vscode.StatusBarItem;
let codeLensProvider: CodeLensProvider | undefined;
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
      // Re-check the match in case the file was modified
      await ensureIndexLoaded();
      const freshMatch = ownersFor(rel);
      const lineToNavigate = freshMatch ? freshMatch.line : match.line;

      const doc = await vscode.workspace.openTextDocument(codeownersIndex.file);
      const editor = await vscode.window.showTextDocument(doc);
      const position = new vscode.Position(lineToNavigate - 1, 0);
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

  // Show all teams command
  const showTeamsDisposable = vscode.commands.registerCommand("codeowners.showTeams", async () => {
    await ensureIndexLoaded();

    if (!codeownersIndex.file) {
      vscode.window.showInformationMessage("No CODEOWNERS file found in this workspace.");
      return;
    }

    const teams = extractAllTeams(codeownersIndex.entries);
    const stats = getTeamStats(codeownersIndex.entries);

    // Create output
    const output = teams
      .map((team) => {
        const count = stats.get(team) || 0;
        const config = getTeamConfig(team);
        const displayName = config?.displayName || team;
        const slack = config?.slack ? ` (${config.slack})` : "";
        return `${displayName}${slack}: ${count} ${count === 1 ? "pattern" : "patterns"}`;
      })
      .join("\n");

    const message = `Teams in CODEOWNERS:\n\n${output}\n\nTotal: ${teams.length} teams`;
    vscode.window.showInformationMessage(message, { modal: true });
  });

  context.subscriptions.push(showTeamsDisposable);

  // Suggest ownership change command
  const suggestOwnershipDisposable = vscode.commands.registerCommand(
    "codeowners.suggestOwnership",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a file to suggest ownership.");
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

      const teams = extractAllTeams(codeownersIndex.entries);
      if (teams.length === 0) {
        vscode.window.showInformationMessage("No teams found in CODEOWNERS.");
        return;
      }

      // Show quick pick of teams
      const selectedTeam = await vscode.window.showQuickPick(
        teams.map((team) => {
          const config = getTeamConfig(team);
          return {
            label: team,
            description: config?.displayName || undefined,
            detail: config?.description || undefined,
          };
        }),
        {
          placeHolder: "Select team to assign ownership",
          matchOnDescription: true,
          matchOnDetail: true,
        },
      );

      if (!selectedTeam) return;

      const currentMatch = ownersFor(rel);
      const currentOwners = currentMatch
        ? `Current: ${currentMatch.owners.join(", ")}`
        : "Currently unowned";

      // Generate suggested pattern - use specific file path for precision
      const suggestedLine = `${rel} ${selectedTeam.label}`;

      const actions = ["Copy to Clipboard", "Open CODEOWNERS", "Close"];
      const message = `${currentOwners}\n\nSuggested rule to add to CODEOWNERS:\n${suggestedLine}\n\n(Add this at the end of CODEOWNERS for highest precedence)`;

      const selection = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        ...actions,
      );

      if (selection === "Copy to Clipboard") {
        await vscode.env.clipboard.writeText(suggestedLine);
        vscode.window.showInformationMessage("Pattern copied to clipboard");
      } else if (selection === "Open CODEOWNERS" && codeownersIndex.file) {
        const doc = await vscode.workspace.openTextDocument(codeownersIndex.file);
        await vscode.window.showTextDocument(doc);
        // Move cursor to end
        const lineCount = doc.lineCount;
        const position = new vscode.Position(lineCount, 0);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
        }
      }
    },
  );

  context.subscriptions.push(suggestOwnershipDisposable);

  // Change ownership command (with file mutation)
  const changeOwnershipDisposable = vscode.commands.registerCommand(
    "codeowners.changeOwnership",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a file to change ownership.");
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

      const teams = extractAllTeams(codeownersIndex.entries);
      if (teams.length === 0) {
        vscode.window.showInformationMessage("No teams found in CODEOWNERS.");
        return;
      }

      // Show quick pick of teams
      const selectedTeam = await vscode.window.showQuickPick(
        teams.map((team) => {
          const config = getTeamConfig(team);
          return {
            label: team,
            description: config?.displayName || undefined,
            detail: config?.description || undefined,
          };
        }),
        {
          placeHolder: "Select new team owner",
          matchOnDescription: true,
          matchOnDetail: true,
        },
      );

      if (!selectedTeam) return;

      const currentMatch = ownersFor(rel);
      const result = await applyOwnershipChange(
        codeownersIndex.file,
        rel,
        selectedTeam.label,
        currentMatch,
      );

      if (result.success) {
        // Reload the index
        codeownersIndex = { entries: [] };
        fileCache.clear();
        await ensureIndexLoaded();
        updateFooter();

        // Refresh CodeLens for all open files
        if (codeLensProvider) {
          codeLensProvider.refresh();
        }

        vscode.window.showInformationMessage(`✅ ${result.message}`);
      } else {
        vscode.window.showErrorMessage(`❌ ${result.message}`);
      }
    },
  );

  context.subscriptions.push(changeOwnershipDisposable);

  // Add CodeLens provider
  const enableCodeLens = config.get<boolean>("enableCodeLens", true);
  if (enableCodeLens) {
    codeLensProvider = new CodeLensProvider();
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
        ensureIndexLoaded().then(() => {
          updateFooter();
          // Refresh CodeLens for all open files
          if (codeLensProvider) {
            codeLensProvider.refresh();
          }
        });
      }
    }),
  );

  updateFooter();
}

export function deactivate() {}

class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

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

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
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
      codeownersIndex = { file: abs, entries: parseCodeOwners(content) };
      break;
    }
  }
}

// Get team configuration from settings (optional metadata)
interface TeamConfig {
  displayName?: string;
  slack?: string;
  description?: string;
}

function getTeamConfig(team: string): TeamConfig | undefined {
  const config = vscode.workspace.getConfiguration("codeowners");
  const teams = config.get<Record<string, TeamConfig>>("teams", {});
  return teams[team];
}

// Apply ownership change to CODEOWNERS file
async function applyOwnershipChange(
  codeownersPath: string,
  filePath: string,
  newOwner: string,
  currentMatch: OwnersMatch | undefined,
): Promise<{ success: boolean; message: string }> {
  try {
    const doc = await vscode.workspace.openTextDocument(codeownersPath);
    const content = doc.getText();
    const lines = content.split(/\r?\n/);

    // Case 1: Exact match exists - update inline
    if (currentMatch && isExactMatch(currentMatch.pattern, filePath)) {
      // Find the line and update it
      const lineIndex = currentMatch.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        // Show preview
        const oldLine = lines[lineIndex];
        const newLine = `${currentMatch.pattern} ${newOwner}`;

        const confirm = await vscode.window.showWarningMessage(
          `Update existing rule?\n\nOld: ${oldLine}\nNew: ${newLine}`,
          { modal: true },
          "Update",
          "Cancel",
        );

        if (confirm !== "Update") {
          return { success: false, message: "Cancelled by user" };
        }

        // Use WorkspaceEdit to modify the document
        const edit = new vscode.WorkspaceEdit();
        const lineRange = doc.lineAt(lineIndex).range;
        edit.replace(doc.uri, lineRange, newLine);
        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
          await doc.save();
          return {
            success: true,
            message: `Updated ownership for ${currentMatch.pattern} to ${newOwner}`,
          };
        }
        return { success: false, message: "Failed to apply edit" };
      }
    }

    // Case 2 & 3: Add specific override at the end
    // (either glob match or no match at all)
    // Add leading slash to ensure root-relative path
    const pathWithSlash = filePath.startsWith("/") ? filePath : `/${filePath}`;
    const newLine = `${pathWithSlash} ${newOwner}`;

    const action = currentMatch
      ? `Override glob pattern (${currentMatch.pattern})`
      : "Add new ownership rule";

    const confirm = await vscode.window.showWarningMessage(
      `${action}?\n\nAdd to CODEOWNERS:\n${newLine}`,
      { modal: true },
      "Add",
      "Cancel",
    );

    if (confirm !== "Add") {
      return { success: false, message: "Cancelled by user" };
    }

    // Add at the end using WorkspaceEdit
    const edit = new vscode.WorkspaceEdit();
    const lastLineNumber = doc.lineCount - 1;
    const lastLine = doc.lineAt(lastLineNumber);
    const endPosition = lastLine.range.end;

    let textToInsert = newLine;
    // Add newline before if the last line isn't empty
    if (lastLine.text.trim() !== "") {
      textToInsert = `\n\n${newLine}`;
    } else if (!lastLine.text) {
      textToInsert = `\n${newLine}`;
    }

    edit.insert(doc.uri, endPosition, textToInsert);
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      await doc.save();
      return {
        success: true,
        message: currentMatch
          ? `Added specific override for ${filePath} (was: ${currentMatch.pattern})`
          : `Added ownership for ${filePath}`,
      };
    }
    return { success: false, message: "Failed to apply edit" };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update CODEOWNERS: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function ownersFor(relPathFromRoot: string): OwnersMatch | undefined {
  // Check cache first
  const cached = fileCache.get(relPathFromRoot);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.match;
  }

  const winner = findOwnersForPath(relPathFromRoot, codeownersIndex.entries);

  // Cache the result
  fileCache.set(relPathFromRoot, { match: winner, timestamp: Date.now() });
  return winner;
}
