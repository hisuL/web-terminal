const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", ".web-terminal");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const RECENT_DIRS_FILE = path.join(DATA_DIR, "recent-dirs.json");

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

function recordRecentDir(dirPath) {
  if (!dirPath) return;
  const data = getRecentDirs();
  const now = new Date().toISOString();
  const idx = data.entries.findIndex((e) => e.path === dirPath);
  if (idx >= 0) {
    data.entries[idx].timestamp = now;
  } else {
    data.entries.push({ path: dirPath, timestamp: now });
  }
  // Sort by timestamp descending and cap at MAX
  data.entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (data.entries.length > MAX_RECENT_DIRS) {
    data.entries = data.entries.slice(0, MAX_RECENT_DIRS);
  }
  saveRecentDirs(data);
}

function getTopRecentDirs(limit = 10) {
  const data = getRecentDirs();
  data.entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return data.entries.slice(0, limit);
}

module.exports = {
  getConfig,
  saveConfig,
  getRecentDirs,
  saveRecentDirs,
  recordRecentDir,
  getTopRecentDirs,
};
