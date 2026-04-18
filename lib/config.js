const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", ".web-terminal");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const RECENT_DIRS_FILE = path.join(DATA_DIR, "recent-dirs.json");
const HOOK_CONFIG_FILE = path.join(DATA_DIR, "hook-config.json");
const HOOK_SETTINGS_FILE = path.join(DATA_DIR, "hook-settings.json");
const LOG_DIR = path.join(DATA_DIR, "logs");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, defaults) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.warn(`Warning: failed to parse ${filePath}, using defaults:`, e.message);
    }
    return defaults;
  }
}

function writeJSON(filePath, data) {
  ensureDataDir();
  const tmp = filePath + "." + crypto.randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

// --- Config (auth) ---

function getConfig() {
  return readJSON(CONFIG_FILE, {});
}

function saveConfig(config) {
  writeJSON(CONFIG_FILE, config);
}

// --- Recent Dirs ---

const MAX_RECENT_DIRS = 50;

function getRecentDirs() {
  const data = readJSON(RECENT_DIRS_FILE, { entries: [] });
  if (!Array.isArray(data.entries)) return { entries: [] };
  return data;
}

function saveRecentDirs(data) {
  writeJSON(RECENT_DIRS_FILE, data);
}

function upsertRecentDirEntry(dirPath, updater) {
  if (!dirPath) return;
  const data = getRecentDirs();
  const now = new Date().toISOString();
  const idx = data.entries.findIndex((e) => e.path === dirPath);
  let entry;
  if (idx >= 0) {
    entry = data.entries[idx];
    entry.timestamp = now;
  } else {
    entry = { path: dirPath, timestamp: now };
    data.entries.push(entry);
  }
  if (typeof updater === "function") updater(entry, now);
  // Sort by timestamp descending and cap at MAX
  data.entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (data.entries.length > MAX_RECENT_DIRS) {
    data.entries = data.entries.slice(0, MAX_RECENT_DIRS);
  }
  saveRecentDirs(data);
}

function recordRecentDir(dirPath) {
  upsertRecentDirEntry(dirPath);
}

function recordRecentLaunch(dirPath, launch) {
  if (!dirPath) return;
  upsertRecentDirEntry(dirPath, (entry, now) => {
    entry.lastLaunch = {
      aiTool: launch?.aiTool || null,
      initCmd: launch?.initCmd || null,
      opts: launch?.opts && typeof launch.opts === "object" ? launch.opts : {},
      sessionName: launch?.sessionName || null,
      timestamp: now,
    };
    entry.historyMeta = {
      lastShell: launch?.shell || "bash",
      launchCount: (entry.historyMeta?.launchCount || 0) + 1,
    };
  });
}

function getRecentDirEntry(dirPath) {
  if (!dirPath) return null;
  const data = getRecentDirs();
  return data.entries.find((e) => e.path === dirPath) || null;
}

function getTopRecentDirs(limit = 10) {
  const data = getRecentDirs();
  data.entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return data.entries.slice(0, limit);
}

function getSessionHistory(query = "", limit = 100) {
  const data = getRecentDirs();
  const keyword = String(query || "").trim().toLowerCase();
  const items = data.entries
    .filter((entry) => entry.lastLaunch)
    .filter((entry) => {
      if (!keyword) return true;
      const haystack = [
        entry.path,
        path.basename(entry.path || ""),
        entry.lastLaunch?.initCmd || "",
        entry.lastLaunch?.aiTool || "",
        entry.lastLaunch?.sessionName || "",
      ].join("\n").toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => {
      const timeCmp = (b.timestamp || "").localeCompare(a.timestamp || "");
      if (timeCmp !== 0) return timeCmp;
      return (b.historyMeta?.launchCount || 0) - (a.historyMeta?.launchCount || 0);
    })
    .slice(0, limit)
    .map((entry) => ({
      path: entry.path,
      timestamp: entry.timestamp,
      lastLaunch: entry.lastLaunch,
      launchCount: entry.historyMeta?.launchCount || 0,
    }));
  return items;
}

// --- Hook Config ---

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getHookConfig() {
  return readJSON(HOOK_CONFIG_FILE, {});
}

function saveHookConfig(config) {
  writeJSON(HOOK_CONFIG_FILE, config);
}

function initHookConfig(serverUrl) {
  ensureLogDir();
  const existing = getHookConfig();
  if (existing.secret) {
    // Always update URL (port or host may change), keep secret stable
    if (existing.url !== serverUrl) {
      existing.url = serverUrl;
      saveHookConfig(existing);
    }
    return existing;
  }
  const config = {
    url: serverUrl,
    secret: crypto.randomUUID(),
  };
  saveHookConfig(config);
  return config;
}

// --- Hook Settings ---

function getHookSettings() {
  return readJSON(HOOK_SETTINGS_FILE, { projects: {} });
}

function saveHookSettings(settings) {
  writeJSON(HOOK_SETTINGS_FILE, settings);
}

function getProjectHookSettings(projectPath) {
  const settings = getHookSettings();
  return settings.projects[projectPath] || null;
}

function saveProjectHookSettings(projectPath, projectSettings) {
  const settings = getHookSettings();
  settings.projects[projectPath] = projectSettings;
  saveHookSettings(settings);
}

const DEFAULT_CLAUDE_EVENTS = {
  Notification: true,
  PermissionRequest: true,
  Stop: true,
  TaskCompleted: true,
  SubagentStop: false,
  PreToolUse: false,
  PostToolUse: false,
};

const DEFAULT_CODEX_EVENTS = {
  SessionStart: false,
  PreToolUse: false,
  PostToolUse: false,
  UserPromptSubmit: false,
  Stop: true,
  notify: true,
};

function getDefaultHookSettings() {
  return {
    claude: { events: { ...DEFAULT_CLAUDE_EVENTS } },
    codex: { events: { ...DEFAULT_CODEX_EVENTS } },
    lastSynced: null,
  };
}

module.exports = {
  DATA_DIR,
  getConfig,
  saveConfig,
  getRecentDirs,
  saveRecentDirs,
  recordRecentDir,
  recordRecentLaunch,
  getRecentDirEntry,
  getTopRecentDirs,
  getSessionHistory,
  getHookConfig,
  saveHookConfig,
  initHookConfig,
  getHookSettings,
  saveHookSettings,
  getProjectHookSettings,
  saveProjectHookSettings,
  getDefaultHookSettings,
  DEFAULT_CLAUDE_EVENTS,
  DEFAULT_CODEX_EVENTS,
};
