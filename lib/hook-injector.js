const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HOOKS_DIR = path.join(__dirname, "hooks");
const CLAUDE_HOOK_SCRIPT = path.join(HOOKS_DIR, "web_terminal_hook_claude.sh");
const CODEX_HOOK_SCRIPT = path.join(HOOKS_DIR, "web_terminal_hook_codex.sh");
const CODEX_NOTIFY_SCRIPT = path.join(HOOKS_DIR, "web_terminal_hook_codex_notify.sh");

const WT_HOOK_MARKER = "web_terminal_hook_";
const WT_CODEX_NOTIFY_BASENAME = path.basename(CODEX_NOTIFY_SCRIPT);

// ---- Helpers ----

function readJSONSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.warn(`[hook-injector] Warning: failed to parse ${filePath}: ${e.message}`);
    }
    return null;
  }
}

function writeJSONAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + "." + crypto.randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function isWtHook(hookEntry) {
  if (!hookEntry || !Array.isArray(hookEntry.hooks)) return false;
  return hookEntry.hooks.some(
    (h) => h.command && h.command.includes(WT_HOOK_MARKER)
  );
}

function ensureCodexDir(projectPath) {
  const codexPath = path.join(projectPath, ".codex");
  if (!fs.existsSync(codexPath)) {
    fs.mkdirSync(codexPath, { recursive: true });
    return codexPath;
  }

  const stat = fs.statSync(codexPath);
  if (stat.isDirectory()) return codexPath;

  const backupPath = path.join(projectPath, `.codex.file.bak.${Date.now()}`);
  fs.copyFileSync(codexPath, backupPath);
  fs.unlinkSync(codexPath);
  fs.mkdirSync(codexPath, { recursive: true });
  console.warn(`[hook-injector] Migrated file .codex -> directory for ${projectPath}; backup: ${backupPath}`);
  return codexPath;
}

function getCodexPaths(projectPath, { ensureDir = false } = {}) {
  const codexDir = ensureDir ? ensureCodexDir(projectPath) : path.join(projectPath, ".codex");
  return {
    codexDir,
    hooksPath: path.join(codexDir, "hooks.json"),
    configPath: path.join(codexDir, "config.toml"),
  };
}

// ---- Claude Hook Injection ----

function buildClaudeHookEntry(scriptPath) {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: scriptPath,
        timeout: 30,
      },
    ],
  };
}

/**
 * Read which Claude events currently have Web Terminal hooks installed.
 * Returns object like {Notification: true, Stop: true, ...}
 */
function readClaudeHooks(projectPath) {
  const settingsPath = path.join(projectPath, ".claude", "settings.json");
  const settings = readJSONSafe(settingsPath);
  if (!settings || !settings.hooks) return {};

  const result = {};
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (Array.isArray(entries)) {
      result[event] = entries.some(isWtHook);
    }
  }
  return result;
}

/**
 * Inject Web Terminal hooks into project's .claude/settings.json
 * for the given enabled events. Preserves all user hooks.
 */
function injectClaudeHooks(projectPath, enabledEvents) {
  const settingsPath = path.join(projectPath, ".claude", "settings.json");
  let settings = readJSONSafe(settingsPath);

  if (!settings) {
    // Create .claude dir if needed
    const claudeDir = path.join(projectPath, ".claude");
    if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
    settings = {};
  }

  if (!settings.hooks) settings.hooks = {};

  const wtEntry = buildClaudeHookEntry(CLAUDE_HOOK_SCRIPT);

  for (const event of Object.keys(enabledEvents)) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }

    // Remove existing WT hooks for this event
    settings.hooks[event] = settings.hooks[event].filter((e) => !isWtHook(e));

    // Add WT hook if enabled
    if (enabledEvents[event]) {
      settings.hooks[event].push(wtEntry);
    }

    // Clean up empty arrays
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }

  // Clean up empty hooks object
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeJSONAtomic(settingsPath, settings);
}

/**
 * Remove ALL Web Terminal hooks from project's .claude/settings.json
 */
function removeClaudeHooks(projectPath) {
  const settingsPath = path.join(projectPath, ".claude", "settings.json");
  const settings = readJSONSafe(settingsPath);
  if (!settings || !settings.hooks) return;

  for (const event of Object.keys(settings.hooks)) {
    if (Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = settings.hooks[event].filter((e) => !isWtHook(e));
      if (settings.hooks[event].length === 0) {
        delete settings.hooks[event];
      }
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeJSONAtomic(settingsPath, settings);
}

// ---- Codex Hook Injection ----

function buildCodexHookEntry(scriptPath) {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: scriptPath,
        timeout: 30,
      },
    ],
  };
}

/**
 * Read which Codex events currently have Web Terminal hooks installed.
 */
function readCodexHooks(projectPath) {
  const result = { hooks: {}, notify: false };

  // Check hooks.json
  const hooksPath = path.join(projectPath, ".codex", "hooks.json");
  const hooksData = readJSONSafe(hooksPath);
  if (hooksData && hooksData.hooks) {
    for (const [event, entries] of Object.entries(hooksData.hooks)) {
      if (Array.isArray(entries)) {
        result.hooks[event] = entries.some(isWtHook);
      }
    }
  }

  // Check config.toml for notify
  const configPath = path.join(projectPath, ".codex", "config.toml");
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf8");
      result.notify = content.includes(WT_HOOK_MARKER);
    } catch {}
  }

  return result;
}

/**
 * Simple TOML reader/writer for config.toml — only handles flat key=value
 */
function readToml(filePath) {
  const lines = [];
  const values = {};
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      lines.push(line);
      const m = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (m) {
        let val = m[2].trim();
        // Remove quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        // Handle arrays like ["cmd", "arg"]
        if (val.startsWith("[")) {
          try { val = JSON.parse(val); } catch {}
        }
        // Handle booleans
        if (val === "true") val = true;
        if (val === "false") val = false;
        values[m[1]] = val;
      }
    }
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.warn(`[hook-injector] Warning: failed to read ${filePath}: ${e.message}`);
    }
  }
  return { lines, values };
}

function writeToml(filePath, lines) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + "." + crypto.randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, lines.join("\n"), "utf8");
  fs.renameSync(tmp, filePath);
}

/**
 * Inject Web Terminal hooks into Codex config
 */
function injectCodexHooks(projectPath, enabledEvents) {
  const { codexDir, hooksPath, configPath } = getCodexPaths(projectPath, { ensureDir: true });

  // --- hooks.json ---
  const CODEX_HOOK_EVENTS = ["SessionStart", "PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop"];
  const hasAnyHookEvent = CODEX_HOOK_EVENTS.some(e => enabledEvents[e] !== undefined);
  if (hasAnyHookEvent) {
    let hooksData = readJSONSafe(hooksPath) || {};
    if (!hooksData.hooks) hooksData.hooks = {};

    const wtEntry = buildCodexHookEntry(CODEX_HOOK_SCRIPT);

    for (const event of CODEX_HOOK_EVENTS) {
      if (enabledEvents[event] === undefined) continue;
      if (!Array.isArray(hooksData.hooks[event])) {
        hooksData.hooks[event] = [];
      }
      // Remove existing WT hooks
      hooksData.hooks[event] = hooksData.hooks[event].filter((e) => !isWtHook(e));
      // Add if enabled
      if (enabledEvents[event]) {
        hooksData.hooks[event].push(wtEntry);
      }
      if (hooksData.hooks[event].length === 0) {
        delete hooksData.hooks[event];
      }
    }

    if (Object.keys(hooksData.hooks).length === 0) {
      delete hooksData.hooks;
    }

    writeJSONAtomic(hooksPath, hooksData);

    // Enable codex_hooks in config.toml if any hook event is enabled
    const anyEnabled = CODEX_HOOK_EVENTS.some(e => enabledEvents[e]);
    if (anyEnabled) {
      _setCodexConfigValue(codexDir, "codex_hooks", "true");
    }
  }

  // --- config.toml notify ---
  if (enabledEvents.notify !== undefined) {
    const { lines, values } = readToml(configPath);

    if (enabledEvents.notify) {
      const existingNotify = Array.isArray(values.notify)
        ? [...values.notify]
        : values.notify ? [values.notify] : [];
      const filtered = existingNotify.filter((item) => !String(item).includes(WT_HOOK_MARKER));
      filtered.push(CODEX_NOTIFY_SCRIPT);
      _setTomlValue(lines, "notify", JSON.stringify(filtered));
      writeToml(configPath, lines);
    } else {
      const existingNotify = Array.isArray(values.notify)
        ? [...values.notify]
        : values.notify ? [values.notify] : [];
      const filtered = existingNotify.filter((item) => !String(item).includes(WT_HOOK_MARKER));
      if (filtered.length !== existingNotify.length) {
        if (filtered.length > 0) {
          _setTomlValue(lines, "notify", JSON.stringify(filtered));
        } else {
          _removeTomlKey(lines, "notify");
        }
        writeToml(configPath, lines);
      }
    }
  }
}

function _setCodexConfigValue(codexDir, key, value) {
  const configPath = path.join(codexDir, "config.toml");
  const { lines } = readToml(configPath);
  _setTomlValue(lines, key, value);
  writeToml(configPath, lines);
}

function _setTomlValue(lines, key, value) {
  const idx = lines.findIndex((l) => l.match(new RegExp(`^${key}\\s*=`)));
  const newLine = `${key} = ${value}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }
}

function _removeTomlKey(lines, key) {
  const idx = lines.findIndex((l) => l.match(new RegExp(`^${key}\\s*=`)));
  if (idx >= 0) lines.splice(idx, 1);
}

/**
 * Remove ALL Web Terminal hooks from Codex config
 */
function removeCodexHooks(projectPath) {
  const { hooksPath, configPath } = getCodexPaths(projectPath);

  // Clean hooks.json
  const hooksData = readJSONSafe(hooksPath);
  if (hooksData && hooksData.hooks) {
    for (const event of Object.keys(hooksData.hooks)) {
      if (Array.isArray(hooksData.hooks[event])) {
        hooksData.hooks[event] = hooksData.hooks[event].filter((e) => !isWtHook(e));
        if (hooksData.hooks[event].length === 0) delete hooksData.hooks[event];
      }
    }
    if (Object.keys(hooksData.hooks).length === 0) delete hooksData.hooks;
    if (Object.keys(hooksData).length === 0) {
      try { fs.unlinkSync(hooksPath); } catch {}
    } else {
      writeJSONAtomic(hooksPath, hooksData);
    }
  }

  // Clean config.toml notify
  if (fs.existsSync(configPath)) {
    const { lines, values } = readToml(configPath);
    const existingNotify = Array.isArray(values.notify)
      ? [...values.notify]
      : values.notify ? [values.notify] : [];
    const filtered = existingNotify.filter((item) => !String(item).includes(WT_HOOK_MARKER));
    if (filtered.length !== existingNotify.length) {
      if (filtered.length > 0) {
        _setTomlValue(lines, "notify", JSON.stringify(filtered));
      } else {
        _removeTomlKey(lines, "notify");
      }
      writeToml(configPath, lines);
    }
  }
}

// ---- Detection ----

function detectTools(projectPath) {
  const result = { claude: false, codex: false };

  // Claude: check .claude/ dir
  if (fs.existsSync(path.join(projectPath, ".claude"))) {
    result.claude = true;
  }

  // Codex: check .codex/ dir or command
  if (fs.existsSync(path.join(projectPath, ".codex"))) {
    result.codex = true;
  } else {
    try {
      require("child_process").execSync("which codex 2>/dev/null", { stdio: "pipe" });
      result.codex = true;
    } catch {}
  }

  return result;
}

// ---- High-level sync ----

/**
 * Sync hooks for a project based on settings.
 * Detects tools and injects/removes hooks accordingly.
 */
function syncProjectHooks(projectPath, projectSettings) {
  const tools = detectTools(projectPath);

  if (tools.claude) {
    try {
      injectClaudeHooks(projectPath, projectSettings.claude.events);
    } catch (e) {
      console.error(`[hook-injector] Failed to inject Claude hooks for ${projectPath}:`, e.message);
    }
  }

  if (tools.codex) {
    try {
      injectCodexHooks(projectPath, projectSettings.codex.events);
    } catch (e) {
      console.error(`[hook-injector] Failed to inject Codex hooks for ${projectPath}:`, e.message);
    }
  }

  return tools;
}

module.exports = {
  readClaudeHooks,
  injectClaudeHooks,
  removeClaudeHooks,
  readCodexHooks,
  injectCodexHooks,
  removeCodexHooks,
  detectTools,
  syncProjectHooks,
  WT_HOOK_MARKER,
};
