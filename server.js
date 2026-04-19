const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const pty = require("node-pty");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { execSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { getConfig, saveConfig, recordRecentDir, recordRecentLaunch, touchRecentSession, getRecentDirEntry, getTopRecentDirs, removeRecentDirEntry, getSessionHistory, initHookConfig, getHookConfig, getHookSettings, saveHookSettings, getProjectHookSettings, saveProjectHookSettings, getDefaultHookSettings } = require("./lib/config");
const { syncProjectHooks, detectTools, readClaudeHooks, readCodexHooks, removeClaudeHooks, removeCodexHooks } = require("./lib/hook-injector");

const app = express();
const server = http.createServer(app);

// --- Protocol ---
// Terminal data: sent as raw strings (no wrapping)
// Control messages: JSON strings prefixed with \x00
const CTRL_PREFIX = "\x00";

function sendCtrl(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(CTRL_PREFIX + JSON.stringify(obj));
  }
}

// --- Notification broadcast (used by /api/notify) ---
function broadcastNotification(notif) {
  const msg = { type: "notification", ...notif, time: notif.timestamp ? new Date(notif.timestamp).getTime() : Date.now() };
  for (const client of lobbyClients) {
    sendCtrl(client, msg);
  }
  for (const session of sessions.values()) {
    for (const client of session.clients) {
      sendCtrl(client, msg);
    }
  }
}

// --- Session Management ---
const sessions = new Map();
const MAX_SCROLLBACK_BYTES = 5 * 1024 * 1024;

function trimScrollback(scrollback, maxBytes = MAX_SCROLLBACK_BYTES) {
  let total = 0;
  for (let i = scrollback.length - 1; i >= 0; i--) {
    total += Buffer.byteLength(scrollback[i], "utf8");
    if (total > maxBytes) {
      scrollback.splice(0, i + 1);
      return;
    }
  }
}

function createSession(name, shell = process.env.SHELL || "bash", cwd, aiTool) {
  const id = crypto.randomUUID().slice(0, 8);
  const cols = 80;
  const rows = 24;

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: cwd || process.env.HOME || "/tmp",
    env: { ...process.env, TERM: "xterm-256color" },
  });

  const scrollback = [];

  ptyProcess.onData((data) => {
    scrollback.push(data);
    trimScrollback(scrollback);

    // Send raw terminal data directly — no JSON wrapping
    const session = sessions.get(id);
    if (session) {
      for (const client of session.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    const session = sessions.get(id);
    if (session) {
      for (const client of session.clients) {
        sendCtrl(client, { type: "exit", code: exitCode });
      }
      sessions.delete(id);
      broadcastSessionList();
    }
  });

  const session = {
    id,
    name: name || `Terminal ${sessions.size + 1}`,
    pty: ptyProcess,
    clients: new Set(),
    createdAt: Date.now(),
    shell,
    cwd: cwd || process.env.HOME || "/tmp",
    historyPath: cwd || process.env.HOME || "/tmp",
    aiTool: aiTool || null,
    scrollback,
    cols,
    rows,
  };

  sessions.set(id, session);
  broadcastSessionList();
  return session;
}

function getSessionRealCwd(session) {
  if (!session) return null;
  if (session.tmuxTarget) {
    try {
      const groupName = `_wt_${session.id}`;
      return execSync(`tmux display-message -t '${groupName}' -p '#{pane_current_path}' 2>/dev/null`).toString().trim() || session.cwd;
    } catch {
      return session.cwd;
    }
  }
  try {
    return fs.readlinkSync(`/proc/${session.pty.pid}/cwd`);
  } catch {
    return session.cwd;
  }
}

function isHistoryPathActive(historyPath) {
  if (!historyPath) return false;
  return Array.from(sessions.values()).some((session) => {
    const sessionHistoryPath = session.historyPath || session.cwd;
    return sessionHistoryPath === historyPath;
  });
}

function broadcastSessionList() {
  const list = getSessionList();
  const msg = { type: "sessions", data: list };
  for (const session of sessions.values()) {
    for (const client of session.clients) {
      sendCtrl(client, msg);
    }
  }
  for (const client of lobbyClients) {
    sendCtrl(client, msg);
  }
}

function getSessionList() {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    clients: s.clients.size,
    cols: s.cols,
    rows: s.rows,
    aiTool: s.aiTool || null,
  }));
}

// --- Static Files ---
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "2mb" }));

// --- Auth helpers ---
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function validateToken(token) {
  if (!token) return false;
  const config = getConfig();
  if (!config.passwordHash) return true; // no password set yet — allow
  const tokens = config.authTokens || [];
  const entry = tokens.find((t) => t.token === token);
  if (!entry) return false;
  return Date.now() - new Date(entry.createdAt).getTime() < TOKEN_MAX_AGE_MS;
}

function pruneExpiredTokens(config) {
  if (!config.authTokens) return;
  config.authTokens = config.authTokens.filter(
    (t) => Date.now() - new Date(t.createdAt).getTime() < TOKEN_MAX_AGE_MS
  );
}

function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function authMiddleware(req, res, next) {
  const config = getConfig();
  if (!config.passwordHash) return next(); // no password set — allow all
  const token = extractToken(req);
  if (!validateToken(token)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// --- Auth API ---
app.get("/api/auth/status", (req, res) => {
  const config = getConfig();
  const passwordSet = !!config.passwordHash;
  const token = extractToken(req);
  const authenticated = passwordSet ? validateToken(token) : false;
  res.json({ passwordSet, authenticated });
});

app.post("/api/auth/setup", async (req, res) => {
  const config = getConfig();
  if (config.passwordHash) {
    return res.status(409).json({ error: "Password already configured" });
  }
  const { password, confirmPassword } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  config.passwordHash = await bcrypt.hash(password, 10);
  const token = crypto.randomUUID();
  config.authTokens = [{ token, createdAt: new Date().toISOString() }];
  saveConfig(config);
  res.json({ token });
});

app.post("/api/auth/login", async (req, res) => {
  const config = getConfig();
  if (!config.passwordHash) {
    return res.status(400).json({ error: "Password not configured" });
  }
  const { password } = req.body || {};
  const match = await bcrypt.compare(password || "", config.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid password" });
  }
  pruneExpiredTokens(config);
  const token = crypto.randomUUID();
  if (!config.authTokens) config.authTokens = [];
  config.authTokens.push({ token, createdAt: new Date().toISOString() });
  saveConfig(config);
  res.json({ token });
});

app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
  const config = getConfig();
  const { oldPassword, newPassword, confirmPassword } = req.body || {};
  const match = await bcrypt.compare(oldPassword || "", config.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  config.passwordHash = await bcrypt.hash(newPassword, 10);
  // Keep only the current caller's token
  const callerToken = extractToken(req);
  config.authTokens = (config.authTokens || []).filter((t) => t.token === callerToken);
  saveConfig(config);
  res.json({ success: true });
});

// --- Recent Dirs API ---
app.get("/api/recent-dirs", authMiddleware, (req, res) => {
  res.json(getTopRecentDirs(10));
});

app.get("/api/recent-dirs/lookup", authMiddleware, (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath) return res.status(400).json({ error: "path required" });
  const entry = getRecentDirEntry(dirPath);
  res.json(entry || null);
});

app.get("/api/session-history", authMiddleware, (req, res) => {
  const q = req.query.q || "";
  const items = getSessionHistory(q, 100).map((item) => ({
    ...item,
    deletable: !isHistoryPathActive(item.path),
  }));
  res.json(items);
});

// --- Hook Notification API (US-002) ---
// This endpoint does NOT use authMiddleware — hook scripts authenticate via secret
app.post("/api/notify", (req, res) => {
  const { tool, event, cwd, message, secret, sessionId, notificationType, toolName, timestamp } = req.body || {};
  if (!tool || !event || !message) {
    return res.status(400).json({ error: "Missing required fields (tool, event, message)" });
  }
  const hookConfig = getHookConfig();
  if (!hookConfig.secret || secret !== hookConfig.secret) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const activeSessions = Array.from(sessions.values()).map(s => {
    const realCwd = getSessionRealCwd(s);
    return `${s.id}(${realCwd})`;
  }).join(", ");
  console.log(`[notify] event=${event} tool=${tool} cwd=${cwd} | active sessions: [${activeSessions || "none"}]`);

  let matchedSessionId = null;
  let matchedSessionName = null;
  if (cwd) {
    // Match: session's real cwd must equal or be a subdirectory of the notification cwd
    let bestMatch = null;
    let bestLen = 0;
    for (const s of sessions.values()) {
      const realCwd = getSessionRealCwd(s);
      if (realCwd && (realCwd === cwd || realCwd.startsWith(cwd + "/"))) {
        if (realCwd.length > bestLen) {
          bestLen = realCwd.length;
          bestMatch = s;
        }
      }
    }
    if (bestMatch) {
      matchedSessionId = bestMatch.id;
      matchedSessionName = bestMatch.name;
      console.log(`[notify] matched session=${bestMatch.id} name=${bestMatch.name} → broadcasting`);
    } else {
      console.log(`[notify] no matching session for cwd=${cwd} → dropped`);
      return res.json({ ok: true, dropped: true });
    }
  } else {
    console.log(`[notify] no cwd provided → broadcasting to all`);
  }

  broadcastNotification({
    tool,
    event,
    cwd: cwd || "",
    message,
    sessionId: matchedSessionId,
    sessionName: matchedSessionName || tool,
    notificationType: notificationType || null,
    toolName: toolName || null,
    timestamp: timestamp || new Date().toISOString(),
  });

  res.json({ ok: true });
});

// --- Hook Settings API (US-003) ---
app.get("/api/hook-projects", authMiddleware, (req, res) => {
  const settings = getHookSettings();
  const projects = Object.entries(settings.projects || {}).map(([p, s]) => {
    const tools = detectTools(p);
    const claudeEvents = Object.entries(s.claude?.events || {}).filter(([, v]) => v).map(([k]) => k);
    const codexEvents = Object.entries(s.codex?.events || {}).filter(([, v]) => v).map(([k]) => k);
    return { path: p, claude: tools.claude, codex: tools.codex, events: { claude: claudeEvents, codex: codexEvents }, lastSynced: s.lastSynced };
  });
  res.json(projects);
});

app.get("/api/hook-settings/:encodedPath", authMiddleware, (req, res) => {
  let projectPath;
  try {
    projectPath = Buffer.from(req.params.encodedPath, "base64").toString("utf8");
  } catch {
    return res.status(400).json({ error: "Invalid project path" });
  }
  const ps = getProjectHookSettings(projectPath);
  if (!ps) {
    return res.json(getDefaultHookSettings());
  }
  res.json(ps);
});

app.post("/api/hook-settings/:encodedPath", authMiddleware, (req, res) => {
  let projectPath;
  try {
    projectPath = Buffer.from(req.params.encodedPath, "base64").toString("utf8");
  } catch {
    return res.status(400).json({ error: "Invalid project path" });
  }
  const { claude, codex } = req.body || {};
  const existing = getProjectHookSettings(projectPath) || getDefaultHookSettings();
  if (claude && claude.events) existing.claude.events = { ...existing.claude.events, ...claude.events };
  if (codex && codex.events) existing.codex.events = { ...existing.codex.events, ...codex.events };
  existing.lastSynced = new Date().toISOString();
  saveProjectHookSettings(projectPath, existing);

  // Sync to project config files
  try {
    syncProjectHooks(projectPath, existing);
  } catch (e) {
    console.error("[hook-settings] Sync failed:", e.message);
    return res.json({ ok: true, syncError: e.message });
  }
  res.json({ ok: true });
});

app.post("/api/hook-sync/:encodedPath", authMiddleware, (req, res) => {
  let projectPath;
  try {
    projectPath = Buffer.from(req.params.encodedPath, "base64").toString("utf8");
  } catch {
    return res.status(400).json({ error: "Invalid project path" });
  }
  const ps = getProjectHookSettings(projectPath) || getDefaultHookSettings();
  try {
    const tools = syncProjectHooks(projectPath, ps);
    ps.lastSynced = new Date().toISOString();
    saveProjectHookSettings(projectPath, ps);
    res.json({ ok: true, tools });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/hook-detect/:encodedPath", authMiddleware, (req, res) => {
  let projectPath;
  try {
    projectPath = Buffer.from(req.params.encodedPath, "base64").toString("utf8");
  } catch {
    return res.status(400).json({ error: "Invalid project path" });
  }
  res.json(detectTools(projectPath));
});

// --- Auto-inject hooks on session creation (US-006) ---
function autoInjectHooks(cwd, aiTool) {
  if (!cwd) return;
  try {
    const tools = detectTools(cwd);
    // Also consider aiTool hint
    if (aiTool === "claude") tools.claude = true;
    if (aiTool === "codex") tools.codex = true;

    if (!tools.claude && !tools.codex) return;

    // Check if project already has settings (don't reset user customizations)
    let ps = getProjectHookSettings(cwd);
    if (!ps) {
      ps = getDefaultHookSettings();
      // Disable tools not detected
      if (!tools.claude) ps.claude.events = {};
      if (!tools.codex) ps.codex.events = {};
      saveProjectHookSettings(cwd, ps);
    }

    syncProjectHooks(cwd, ps);
    ps.lastSynced = new Date().toISOString();
    saveProjectHookSettings(cwd, ps);
  } catch (e) {
    console.error("[auto-inject] Hook injection failed for", cwd, ":", e.message);
  }
}

// --- AI Shortcuts Proxy ---
app.post("/api/ai-shortcuts", authMiddleware, async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "OPENROUTER_API_KEY not set on server" });
  }
  const { terminalText } = req.body || {};
  if (!terminalText || !terminalText.trim()) {
    return res.status(400).json({ error: "terminalText is required" });
  }

  const systemPrompt = `You are a terminal shortcut assistant. Analyze the terminal output and suggest the most useful keyboard shortcuts for what the user is likely to do next.
Return ONLY a valid JSON array (no markdown, no explanation), max 8 items.
Each item: {"label": "Ctrl+C", "desc": "中断", "sequence": "\\u0003"}
The "sequence" field must be the exact escape sequence string to send to the terminal.
Common sequences: Ctrl+C=\\u0003, Ctrl+D=\\u0004, Ctrl+Z=\\u001a, Ctrl+L=\\u000c, Ctrl+R=\\u0012, Ctrl+A=\\u0001, Ctrl+E=\\u0005, Ctrl+K=\\u000b, Ctrl+U=\\u0015, Ctrl+W=\\u0017, Escape=\\u001b, Tab=\\u0009, Enter=\\r, Up=\\u001b[A, Down=\\u001b[B.
Prioritize shortcuts that are immediately actionable given the current terminal state.`;

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://web-terminal",
        "X-Title": "Web Terminal",
      },
      body: JSON.stringify({
        model: "mistralai/ministral-3b-2512",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Terminal output (last 30 lines):\n${terminalText}` },
        ],
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err?.error?.message || `upstream ${upstream.status}` });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return res.status(502).json({ error: "invalid AI response format" });

    // 尝试修复常见的 JSON 问题（截断、尾部逗号）再解析
    let items;
    try {
      items = JSON.parse(jsonMatch[0]);
    } catch {
      // 尝试截断到最后一个完整对象
      const fixed = jsonMatch[0].replace(/,\s*$/, "").replace(/,\s*\]$/, "]");
      items = JSON.parse(fixed);
    }
    res.json({ items: Array.isArray(items) ? items : [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- REST API ---
app.get("/api/config", authMiddleware, (req, res) => {
  res.json({ aiEnabled: !!process.env.OPENROUTER_API_KEY });
});

app.get("/api/sessions", authMiddleware, (req, res) => {
  res.json(getSessionList());
});

app.post("/api/sessions", authMiddleware, (req, res) => {
  const { name, shell, cwd, initCmd, aiTool, launchMeta } = req.body || {};
  const session = createSession(name, shell, cwd, aiTool);
  // Record recent directory
  if (cwd) recordRecentDir(cwd);
  if (cwd) {
    recordRecentLaunch(cwd, {
      aiTool: launchMeta?.aiTool || aiTool || null,
      initCmd: launchMeta?.initCmd || initCmd || null,
      opts: launchMeta?.opts || {},
      sessionName: launchMeta?.sessionName || name || session.name,
      shell: shell || process.env.SHELL || "bash",
    });
  }
  // Auto-inject hooks (async, non-blocking)
  setImmediate(() => autoInjectHooks(cwd, aiTool));
  // 如果指定了启动命令，在 PTY 启动后延迟发送
  if (initCmd) {
    setTimeout(() => {
      const s = sessions.get(session.id);
      if (s) s.pty.write(initCmd + "\r");
    }, 300);
  }
  res.json({ id: session.id, name: session.name });
});

app.post("/api/session-history/launch", authMiddleware, (req, res) => {
  const { path: dirPath } = req.body || {};
  if (!dirPath) return res.status(400).json({ error: "path required" });
  const entry = getRecentDirEntry(dirPath);
  if (!entry || !entry.lastLaunch) {
    return res.status(404).json({ error: "History entry not found" });
  }
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Directory not found" });
  }

  const launch = entry.lastLaunch;
  const name = launch.sessionName || path.basename(dirPath) || undefined;
  const session = createSession(name, process.env.SHELL || "bash", dirPath, launch.aiTool || undefined);
  recordRecentDir(dirPath);
  recordRecentLaunch(dirPath, {
    aiTool: launch.aiTool || null,
    initCmd: launch.initCmd || null,
    opts: launch.opts || {},
    sessionName: name || session.name,
    shell: process.env.SHELL || "bash",
  });
  setImmediate(() => autoInjectHooks(dirPath, launch.aiTool || null));

  if (launch.initCmd) {
    setTimeout(() => {
      const s = sessions.get(session.id);
      if (s) s.pty.write(launch.initCmd + "\r");
    }, 300);
  }

  res.json({ id: session.id, name: session.name });
});

app.delete("/api/session-history", authMiddleware, (req, res) => {
  const { path: historyPath } = req.body || {};
  if (!historyPath) return res.status(400).json({ error: "path required" });
  if (isHistoryPathActive(historyPath)) {
    return res.status(409).json({ error: "当前会话正在使用该路径，无法删除" });
  }

  const existed = !!getRecentDirEntry(historyPath);
  if (!existed) {
    return res.status(404).json({ error: "历史记录不存在" });
  }

  removeRecentDirEntry(historyPath);

  try { removeClaudeHooks(historyPath); } catch (e) { console.warn("[history-delete] claude:", e.message); }
  try { removeCodexHooks(historyPath); } catch (e) { console.warn("[history-delete] codex:", e.message); }
  try {
    const settings = getHookSettings();
    if (settings.projects && settings.projects[historyPath]) {
      delete settings.projects[historyPath];
      saveHookSettings(settings);
    }
  } catch (e) {
    console.warn("[history-delete] settings:", e.message);
  }

  res.json({ ok: true, path: historyPath });
});

app.post("/api/sessions/:id/activity", authMiddleware, (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const historyPath = session.historyPath || session.cwd;
  if (historyPath) {
    touchRecentSession(historyPath, { sessionName: session.name });
  }

  const realCwd = getSessionRealCwd(session);
  if (realCwd && realCwd !== historyPath) {
    recordRecentDir(realCwd);
  }

  res.json({
    ok: true,
    path: historyPath || null,
    timestamp: new Date().toISOString(),
  });
});

// --- Directory Browser API ---
app.get("/api/dirs", authMiddleware, (req, res) => {
  const reqPath = req.query.path || process.env.HOME || "/";
  let resolved;
  try {
    resolved = path.resolve(reqPath);
  } catch {
    return res.status(400).json({ error: "Invalid path" });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: path.join(resolved, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Also include hidden dirs but after normal ones
    const hiddenDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: path.join(resolved, e.name), hidden: true }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: resolved,
      parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      dirs: [...dirs, ...hiddenDirs],
    });
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

app.post("/api/dirs", authMiddleware, (req, res) => {
  const { path: dirPath } = req.body || {};
  if (!dirPath) return res.status(400).json({ error: "path required" });
  try {
    const resolved = path.resolve(dirPath);
    fs.mkdirSync(resolved, { recursive: true });
    res.json({ path: resolved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Session CWD (US-001) ---
app.get("/api/sessions/:id/cwd", authMiddleware, (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  // tmux 会话：通过 tmux display-message 获取 pane 内 shell 的实际 cwd
  if (session.tmuxTarget) {
    const groupName = `_wt_${session.id}`;
    try {
      const cwd = execSync(`tmux display-message -t '${groupName}' -p '#{pane_current_path}' 2>/dev/null`).toString().trim();
      if (cwd) return res.json({ cwd });
    } catch {}
  }

  try {
    const pid = session.pty.pid;
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    res.json({ cwd });
  } catch (e) {
    // Fallback: use the cwd from session creation
    res.json({ cwd: process.env.HOME || "/tmp" });
  }
});

// --- File System APIs (US-002 ~ US-007) ---
const HIDDEN_DIRS = new Set(["node_modules", ".git", "__pycache__", ".next", "dist", "build", ".cache"]);

// US-002: List directory
app.get("/api/fs/list", authMiddleware, (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: "path required" });
  let resolved;
  try { resolved = path.resolve(reqPath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  let stat;
  try { stat = fs.statSync(resolved); } catch { return res.status(404).json({ error: "Directory not found" }); }
  if (!stat.isDirectory()) return res.status(400).json({ error: "Not a directory" });

  const showHidden = req.query.hidden === "true";
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const result = entries
      .filter((e) => {
        if (!showHidden) {
          if (e.name.startsWith(".")) return false;
          if (e.isDirectory() && HIDDEN_DIRS.has(e.name)) return false;
        }
        return true;
      })
      .map((e) => {
        const fullPath = path.join(resolved, e.name);
        let size = 0, mtime = null;
        try {
          const s = fs.statSync(fullPath);
          size = s.size;
          mtime = s.mtimeMs;
        } catch {}
        return { name: e.name, type: e.isDirectory() ? "directory" : "file", size, mtime };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: resolved, entries: result });
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// US-003: Read file
app.get("/api/fs/read", authMiddleware, (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: "path required" });
  let resolved;
  try { resolved = path.resolve(reqPath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  let stat;
  try { stat = fs.statSync(resolved); } catch { return res.status(404).json({ error: "File not found" }); }
  if (stat.isDirectory()) return res.status(400).json({ error: "Not a file" });

  if (stat.size > 1024 * 1024) {
    return res.json({ path: resolved, size: stat.size, mtime: stat.mtimeMs, tooLarge: true });
  }

  // Check for binary
  try {
    const buf = Buffer.alloc(8192);
    const fd = fs.openSync(resolved, "r");
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) {
        return res.json({ path: resolved, size: stat.size, mtime: stat.mtimeMs, binary: true });
      }
    }
  } catch {}

  try {
    const content = fs.readFileSync(resolved, "utf8");
    res.json({ path: resolved, content, size: stat.size, mtime: stat.mtimeMs });
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// US-004: Write file
app.put("/api/fs/write", authMiddleware, (req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath) return res.status(400).json({ error: "path required" });
  if (typeof content !== "string") return res.status(400).json({ error: "content required" });
  if (Buffer.byteLength(content) > 1024 * 1024) return res.status(413).json({ error: "File too large" });

  let resolved;
  try { resolved = path.resolve(filePath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) return res.status(400).json({ error: "Path is a directory" });
  } catch {}

  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    const stat = fs.statSync(resolved);
    res.json({ ok: true, size: stat.size, mtime: stat.mtimeMs });
  } catch (e) {
    if (e.code === "EACCES") return res.status(403).json({ error: "Permission denied" });
    res.status(500).json({ error: e.message });
  }
});

// US-005: Create, rename, delete
app.post("/api/fs/create", authMiddleware, (req, res) => {
  const { path: fsPath, type } = req.body || {};
  if (!fsPath || !type) return res.status(400).json({ error: "path and type required" });
  let resolved;
  try { resolved = path.resolve(fsPath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  if (fs.existsSync(resolved)) return res.status(409).json({ error: "Already exists" });
  try {
    if (type === "directory") {
      fs.mkdirSync(resolved, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, "", "utf8");
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/fs/rename", authMiddleware, (req, res) => {
  const { oldPath, newPath } = req.body || {};
  if (!oldPath || !newPath) return res.status(400).json({ error: "oldPath and newPath required" });
  let resolvedOld, resolvedNew;
  try {
    resolvedOld = path.resolve(oldPath);
    resolvedNew = path.resolve(newPath);
  } catch { return res.status(400).json({ error: "Invalid path" }); }

  if (!fs.existsSync(resolvedOld)) return res.status(404).json({ error: "Source not found" });
  if (fs.existsSync(resolvedNew)) return res.status(409).json({ error: "Destination already exists" });
  try {
    fs.renameSync(resolvedOld, resolvedNew);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/fs/delete", authMiddleware, (req, res) => {
  const { path: fsPath } = req.body || {};
  if (!fsPath) return res.status(400).json({ error: "path required" });
  let resolved;
  try { resolved = path.resolve(fsPath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  if (!fs.existsSync(resolved)) return res.status(404).json({ error: "Not found" });
  try {
    fs.rmSync(resolved, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// US-007: Download file or folder as zip
app.get("/api/fs/download", authMiddleware, (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: "path required" });
  let resolved;
  try { resolved = path.resolve(reqPath); } catch { return res.status(400).json({ error: "Invalid path" }); }

  if (!fs.existsSync(resolved)) return res.status(404).json({ error: "Not found" });

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    // Single file download
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(resolved)}"`);
    return fs.createReadStream(resolved).pipe(res);
  }

  // Directory zip download
  try {
    const archiver = require("archiver");
    const zipName = path.basename(resolved) + ".zip";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err) => res.status(500).json({ error: err.message }));
    archive.pipe(res);
    archive.directory(resolved, path.basename(resolved));
    archive.finalize();
  } catch (e) {
    res.status(500).json({ error: "archiver not installed. Run: npm install archiver" });
  }
});

// US-006: File upload
app.post("/api/fs/upload", authMiddleware, (req, res) => {
  try {
    const multer = require("multer");
    const dest = req.query.dest || req.body?.dest || "/tmp";
    const resolved = path.resolve(dest);
    fs.mkdirSync(resolved, { recursive: true });
    const upload = multer({ dest: resolved, preservePath: true });
    upload.array("files")(req, res, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      const files = (req.files || []).map((f) => {
        const finalPath = path.join(resolved, f.originalname);
        fs.renameSync(f.path, finalPath);
        return { name: f.originalname, size: f.size };
      });
      res.json({ ok: true, files });
    });
  } catch (e) {
    res.status(500).json({ error: "multer not installed. Run: npm install multer" });
  }
});

app.delete("/api/sessions/:id", authMiddleware, (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const sessionCwd = session.cwd;
  session.pty.kill();
  sessions.delete(req.params.id);
  broadcastSessionList();

  // After removing this session, check if any other session still uses the same cwd.
  // If not, remove Web Terminal hooks from that project (only WT hooks, user hooks untouched).
  if (sessionCwd) {
    setImmediate(() => {
      const stillActive = Array.from(sessions.values()).some((s) => {
        if (!s.cwd) return false;
        return s.cwd === sessionCwd || s.cwd.startsWith(sessionCwd + "/") || sessionCwd.startsWith(s.cwd + "/");
      });
      if (!stillActive) {
        try { removeClaudeHooks(sessionCwd); } catch (e) { console.warn("[hook-cleanup] claude:", e.message); }
        try { removeCodexHooks(sessionCwd); } catch (e) { console.warn("[hook-cleanup] codex:", e.message); }
        // Remove from hook-settings.json so it no longer appears in notification settings UI
        try {
          const settings = getHookSettings();
          if (settings.projects && settings.projects[sessionCwd]) {
            delete settings.projects[sessionCwd];
            saveHookSettings(settings);
          }
        } catch (e) { console.warn("[hook-cleanup] settings:", e.message); }
        console.log(`[hook-cleanup] removed WT hooks and settings for ${sessionCwd}`);
      }
    });
  }

  res.json({ ok: true });
});

app.put("/api/sessions/:id", authMiddleware, (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (req.body.name) session.name = req.body.name;
  broadcastSessionList();
  res.json({ ok: true });
});

// --- tmux Session Scanning ---
function scanTmuxSessions() {
  const results = { tmux: [] };

  try {
    const tmuxSessions = execSync("tmux list-sessions -F '#{session_name}:#{session_windows}:#{session_attached}:#{session_created}' 2>/dev/null")
      .toString().trim().split("\n").filter(Boolean);

    for (const line of tmuxSessions) {
      const [name, windows, attached, created] = line.split(":");
      // Skip grouped sessions created by web-terminal
      if (name.startsWith("_wt_")) continue;
      let windowList = [];
      try {
        windowList = execSync(`tmux list-windows -t '${name}' -F '#{window_index}|#{window_name}|#{pane_current_command}' 2>/dev/null`)
          .toString().trim().split("\n").filter(Boolean).map((w) => {
            const [index, wname, cmd] = w.split("|");
            return { index: Number(index), name: wname, command: cmd };
          });
      } catch {}

      results.tmux.push({
        name,
        windows: Number(windows),
        attached: Number(attached) > 0,
        createdAt: Number(created) * 1000,
        windowList,
      });
    }
  } catch {}

  return results;
}

app.get("/api/external", authMiddleware, (req, res) => {
  res.json(scanTmuxSessions());
});

// Attach to a tmux session window via a grouped session so each tab sees one window independently
app.post("/api/attach/tmux", authMiddleware, (req, res) => {
  const { session: tmuxSession, window: tmuxWindow } = req.body || {};
  if (!tmuxSession) return res.status(400).json({ error: "session required" });

  const target = tmuxWindow !== undefined ? `${tmuxSession}:${tmuxWindow}` : tmuxSession;

  // Dedup: if this exact target already has a tab, just return it
  for (const s of sessions.values()) {
    if (s.tmuxTarget === target) {
      return res.json({ id: s.id, name: s.name });
    }
  }

  // Get window name for display
  let wname = "";
  if (tmuxWindow !== undefined) {
    try {
      wname = execSync(`tmux display-message -t '${target}' -p '#{window_name}' 2>/dev/null`).toString().trim();
    } catch {}
  }
  const name = tmuxWindow !== undefined
    ? `tmux:${tmuxSession}/${wname || tmuxWindow}`
    : `tmux:${tmuxSession}`;

  const id = crypto.randomUUID().slice(0, 8);
  const cols = 80;
  const rows = 24;

  // Use grouped session: creates a temporary session linked to the target,
  // with its own independent current-window pointer. Auto-destroyed on detach.
  const groupSessionName = `_wt_${id}`;
  const args = [
    "new-session", "-d", "-t", tmuxSession, "-s", groupSessionName,
  ];

  // Create the grouped session first
  try {
    execSync(`tmux ${args.map(a => `'${a}'`).join(" ")} 2>/dev/null`);
    if (tmuxWindow !== undefined) {
      execSync(`tmux select-window -t '${groupSessionName}:${tmuxWindow}' 2>/dev/null`);
    }
  } catch (e) {
    return res.status(500).json({ error: "Failed to create tmux grouped session" });
  }

  // Now attach to the grouped session in a PTY
  const ptyProcess = pty.spawn("tmux", ["attach-session", "-t", groupSessionName], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.env.HOME || "/tmp",
    env: { ...process.env, TERM: "xterm-256color" },
  });

  const scrollback = [];

  ptyProcess.onData((data) => {
    scrollback.push(data);
    trimScrollback(scrollback);
    const session = sessions.get(id);
    if (session) {
      for (const client of session.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    // Clean up grouped session
    try { execSync(`tmux kill-session -t '${groupSessionName}' 2>/dev/null`); } catch {}
    const session = sessions.get(id);
    if (session) {
      for (const client of session.clients) {
        sendCtrl(client, { type: "exit", code: exitCode });
      }
      sessions.delete(id);
      broadcastSessionList();
    }
  });

  // Get tmux cwd upfront for session object
  let initialTmuxCwd = null;
  try {
    initialTmuxCwd = execSync(`tmux display-message -t '${target}' -p '#{pane_current_path}' 2>/dev/null`).toString().trim() || null;
  } catch {}

  const session = {
    id,
    name,
    pty: ptyProcess,
    clients: new Set(),
    createdAt: Date.now(),
    shell: "tmux",
    cwd: initialTmuxCwd || process.env.HOME || "/tmp",
    historyPath: initialTmuxCwd || process.env.HOME || "/tmp",
    tmuxTarget: target,
    scrollback,
    cols,
    rows,
  };

  sessions.set(id, session);
  broadcastSessionList();

  // Record tmux session's working directory for recent-dirs and auto-inject hooks
  try {
    const tmuxCwd = initialTmuxCwd || execSync(`tmux display-message -t '${target}' -p '#{pane_current_path}' 2>/dev/null`).toString().trim();
    if (tmuxCwd) {
      recordRecentDir(tmuxCwd);
      setImmediate(() => autoInjectHooks(tmuxCwd));
    }
  } catch {}

  res.json({ id: session.id, name: session.name });
});

// Send a tmux copy-mode command (e.g. history-top, history-bottom)
app.post("/api/tmux/send-command", authMiddleware, (req, res) => {
  const { sessionId, command } = req.body || {};
  if (!sessionId || !command) return res.status(400).json({ error: "sessionId and command required" });

  const allowed = ["history-top", "history-bottom", "page-up", "page-down",
                    "halfpage-up", "halfpage-down", "scroll-up", "scroll-down",
                    "top-line", "bottom-line", "cancel"];
  if (!allowed.includes(command)) return res.status(400).json({ error: "command not allowed" });

  const session = sessions.get(sessionId);
  if (!session || !session.tmuxTarget) return res.status(404).json({ error: "tmux session not found" });

  // Find the grouped session name from the session id
  const groupName = `_wt_${sessionId}`;
  try {
    // Enter copy-mode first (no-op if already in copy-mode)
    execSync(`tmux copy-mode -t '${groupName}' 2>/dev/null`);
    execSync(`tmux send-keys -X -t '${groupName}' ${command} 2>/dev/null`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to execute tmux command" });
  }
});

// --- WebSocket ---
const lobbyClients = new Set();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("session");
  const wsToken = url.searchParams.get("token");

  // WebSocket authentication
  const config = getConfig();
  if (config.passwordHash && !validateToken(wsToken)) {
    sendCtrl(ws, { type: "error", data: "Authentication required" });
    ws.close(4001, "Authentication required");
    return;
  }

  if (!sessionId) {
    lobbyClients.add(ws);
    sendCtrl(ws, { type: "sessions", data: getSessionList() });
    ws.on("close", () => lobbyClients.delete(ws));
    ws.on("message", (raw) => {
      try {
        const str = raw.toString();
        if (str[0] !== CTRL_PREFIX) return;
        const msg = JSON.parse(str.slice(1));
        if (msg.type === "create") {
          const session = createSession(msg.name, msg.shell);
          sendCtrl(ws, { type: "created", data: { id: session.id, name: session.name } });
        }
      } catch {}
    });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendCtrl(ws, { type: "error", data: "Session not found" });
    ws.close();
    return;
  }

  broadcastSessionList();

  // For tmux sessions, defer scrollback until after the first resize.
  // Without this, the client receives the scrollback (captured at 80x24)
  // AND the full redraw triggered by the resize — producing duplicate lines.
  if (session.shell === "tmux") {
    // Don't add to clients yet — prevent onData from sending real-time
    // data that overlaps with the scrollback we're about to send.
    let scrollbackSent = false;

    // Temporary message handler: wait for the first resize, then send
    // scrollback and start forwarding real-time data.
    const earlyHandler = (raw) => {
      const str = raw.toString();
      if (str[0] === CTRL_PREFIX && !scrollbackSent) {
        try {
          const parsed = JSON.parse(str.slice(1));
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            session.cols = parsed.cols;
            session.rows = parsed.rows;
            session.pty.resize(parsed.cols, parsed.rows);

            // Clear old scrollback captured at wrong size — tmux will
            // send a fresh full redraw after the resize.
            session.scrollback.length = 0;
            scrollbackSent = true;

            // Now add client so future onData frames go to it
            session.clients.add(ws);
            return;
          }
        } catch {}
      }
      // If scrollback has been sent, forward input normally
      if (scrollbackSent) {
        if (str[0] !== CTRL_PREFIX) {
          session.pty.write(str);
        } else {
          try {
            const parsed = JSON.parse(str.slice(1));
            if (parsed.type === "resize" && parsed.cols && parsed.rows) {
              session.cols = parsed.cols;
              session.rows = parsed.rows;
              session.pty.resize(parsed.cols, parsed.rows);
            }
          } catch {}
        }
      }
    };
    ws.on("message", earlyHandler);

    // Safety: if no resize arrives within 500ms, fall back to sending
    // scrollback immediately (e.g. if client doesn't send resize).
    setTimeout(() => {
      if (!scrollbackSent) {
        scrollbackSent = true;
        if (session.scrollback.length > 0) {
          ws.send(session.scrollback.join(""));
        }
        session.clients.add(ws);
      }
    }, 500);

    ws.on("close", () => {
      session.clients.delete(ws);
      broadcastSessionList();
    });
  } else {
    // Non-tmux sessions: keep the original immediate replay behavior.
    // The tmux-specific delayed replay fixes duplicate redraws there, but
    // applying the same timing to plain PTY sessions makes history restore
    // depend on resize/reconnect ordering.
    session.clients.add(ws);
    if (session.scrollback.length > 0) {
      ws.send(session.scrollback.join(""));
    }

    ws.on("message", (raw) => {
      const str = raw.toString();
      // Control messages start with \x00
      if (str[0] === CTRL_PREFIX) {
        try {
          const parsed = JSON.parse(str.slice(1));
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            session.cols = parsed.cols;
            session.rows = parsed.rows;
            session.pty.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {}
        return;
      }
      // Raw terminal input
      session.pty.write(str);
    });

    ws.on("close", () => {
      session.clients.delete(ws);
      broadcastSessionList();
    });
  }
});

// --- Start ---
const PORT = process.env.PORT || 3456;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web Terminal running at http://0.0.0.0:${PORT}`);
  // Initialize hook config with server URL
  try {
    initHookConfig(`http://localhost:${PORT}`);
  } catch (e) {
    console.error("[hook-config] Failed to init:", e.message);
  }
});

