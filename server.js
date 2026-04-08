const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const pty = require("node-pty");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { execSync } = require("child_process");

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

// --- Session Management ---
const sessions = new Map();

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
  const MAX_SCROLLBACK = 50 * 1024;

  ptyProcess.onData((data) => {
    scrollback.push(data);
    let total = scrollback.reduce((a, b) => a + b.length, 0);
    while (total > MAX_SCROLLBACK && scrollback.length > 1) {
      total -= scrollback.shift().length;
    }

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
    aiTool: aiTool || null,
    scrollback,
    cols,
    rows,
  };

  sessions.set(id, session);
  broadcastSessionList();
  return session;
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
app.use(express.json());

// --- AI Shortcuts Proxy ---
app.post("/api/ai-shortcuts", async (req, res) => {
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
app.get("/api/config", (req, res) => {
  res.json({ aiEnabled: !!process.env.OPENROUTER_API_KEY });
});

app.get("/api/sessions", (req, res) => {
  res.json(getSessionList());
});

app.post("/api/sessions", (req, res) => {
  const { name, shell, cwd, initCmd, aiTool } = req.body || {};
  const session = createSession(name, shell, cwd, aiTool);
  // 如果指定了启动命令，在 PTY 启动后延迟发送
  if (initCmd) {
    setTimeout(() => {
      const s = sessions.get(session.id);
      if (s) s.pty.write(initCmd + "\r");
    }, 300);
  }
  res.json({ id: session.id, name: session.name });
});

// --- Directory Browser API ---
app.get("/api/dirs", (req, res) => {
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

app.post("/api/dirs", (req, res) => {
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

app.delete("/api/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  session.pty.kill();
  sessions.delete(req.params.id);
  broadcastSessionList();
  res.json({ ok: true });
});

app.put("/api/sessions/:id", (req, res) => {
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

app.get("/api/external", (req, res) => {
  res.json(scanTmuxSessions());
});

// Attach to a tmux session window via a grouped session so each tab sees one window independently
app.post("/api/attach/tmux", (req, res) => {
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
  const MAX_SCROLLBACK = 50 * 1024;

  ptyProcess.onData((data) => {
    scrollback.push(data);
    let total = scrollback.reduce((a, b) => a + b.length, 0);
    while (total > MAX_SCROLLBACK && scrollback.length > 1) {
      total -= scrollback.shift().length;
    }
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

  const session = {
    id,
    name,
    pty: ptyProcess,
    clients: new Set(),
    createdAt: Date.now(),
    shell: "tmux",
    tmuxTarget: target,
    scrollback,
    cols,
    rows,
  };

  sessions.set(id, session);
  broadcastSessionList();
  res.json({ id: session.id, name: session.name });
});

// --- WebSocket ---
const lobbyClients = new Set();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("session");

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

  session.clients.add(ws);
  broadcastSessionList();

  // Send scrollback as raw data
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
});

// --- Start ---
const PORT = process.env.PORT || 3456;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web Terminal running at http://0.0.0.0:${PORT}`);
});

createSession("Default");
