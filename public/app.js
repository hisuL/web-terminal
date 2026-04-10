(() => {
  const CTRL_PREFIX = "\x00";

  // --- SVG Icon Library ---
  const SVG = {
    bell: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    folderOpen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v1"/><path d="M2 10h20l-2 9H4z"/></svg>',
    file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    unlock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>',
    soundOn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>',
    soundOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    claude: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    codex: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    dirFolder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
  };

  // State
  let sessions = [];
  let activeSessionId = null;
  let terminal = null;
  let fitAddon = null;
  let termWs = null;
  let lobbyWs = null;
  let reconnectTimer = null;
  let sidebarOpen = false;
  let shortcutBarOpen = false;
  let currentFontSize = window.innerWidth <= 768 ? 13 : 15;
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 32;

  // --- Color Themes ---
  const COLOR_THEMES = [
    {
      id: "cyber-hud", name: "Cyber HUD",
      bg: "#080c14",
      ui: { bgSidebar: "#0a0f18", bgHover: "#131a27", bgActive: "#1a2744", text: "#c8d6e5", textDim: "#4a5568", accent: "#22d3ee", danger: "#f85149", success: "#2ea043", border: "rgba(56,189,248,0.1)", warning: "#d29922" },
      theme: {
        background: "#080c14", foreground: "#c8d6e5", cursor: "#22d3ee",
        selectionBackground: "#1a2744",
        black: "#0a0f18", red: "#f85149", green: "#2ea043", yellow: "#d29922",
        blue: "#22d3ee", magenta: "#bb9af7", cyan: "#38bdf8", white: "#c8d6e5",
        brightBlack: "#4a5568", brightRed: "#ff6b63", brightGreen: "#3bba57",
        brightYellow: "#e5ad30", brightBlue: "#56e0f5", brightMagenta: "#c7a9ff",
        brightCyan: "#67d4f7", brightWhite: "#e2e8f0",
      },
    },
    {
      id: "vscode-dark", name: "VS Code Dark",
      bg: "#1e1e1e",
      ui: { bgSidebar: "#252526", bgHover: "#2a2d2e", bgActive: "#094771", text: "#d4d4d4", textDim: "#858585", accent: "#569cd6", danger: "#f44747", success: "#6a9955", border: "#3c3c3c" },
      theme: {
        background: "#1e1e1e", foreground: "#d4d4d4", cursor: "#aeafad",
        selectionBackground: "#264f78",
        black: "#1e1e1e", red: "#f44747", green: "#6a9955", yellow: "#dcdcaa",
        blue: "#569cd6", magenta: "#c586c0", cyan: "#4ec9b0", white: "#d4d4d4",
        brightBlack: "#808080", brightRed: "#f44747", brightGreen: "#b5cea8",
        brightYellow: "#dcdcaa", brightBlue: "#9cdcfe", brightMagenta: "#c586c0",
        brightCyan: "#4ec9b0", brightWhite: "#e5e5e5",
      },
    },
    {
      id: "tokyo-night", name: "Tokyo Night",
      bg: "#1a1b26",
      ui: { bgSidebar: "#16161e", bgHover: "#292e42", bgActive: "#33467c", text: "#c0caf5", textDim: "#565f89", accent: "#7aa2f7", danger: "#f7768e", success: "#9ece6a", border: "#292e42" },
      theme: {
        background: "#1a1b26", foreground: "#c0caf5", cursor: "#c0caf5",
        selectionBackground: "#283457",
        black: "#15161e", red: "#f7768e", green: "#9ece6a", yellow: "#e0af68",
        blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
        brightBlack: "#414868", brightRed: "#ff899d", brightGreen: "#9fe044",
        brightYellow: "#faba4a", brightBlue: "#8db0ff", brightMagenta: "#c7a9ff",
        brightCyan: "#a4daff", brightWhite: "#c0caf5",
      },
    },
    {
      id: "dracula", name: "Dracula",
      bg: "#282A36",
      ui: { bgSidebar: "#21222C", bgHover: "#44475A", bgActive: "#6272A4", text: "#F8F8F2", textDim: "#6272A4", accent: "#BD93F9", danger: "#FF5555", success: "#50FA7B", border: "#44475A" },
      theme: {
        background: "#282A36", foreground: "#F8F8F2", cursor: "#F8F8F2",
        selectionBackground: "#44475A",
        black: "#21222C", red: "#FF5555", green: "#50FA7B", yellow: "#F1FA8C",
        blue: "#BD93F9", magenta: "#FF79C6", cyan: "#8BE9FD", white: "#F8F8F2",
        brightBlack: "#6272A4", brightRed: "#FF6E6E", brightGreen: "#69FF94",
        brightYellow: "#FFFFA5", brightBlue: "#D6ACFF", brightMagenta: "#FF92DF",
        brightCyan: "#A4FFFF", brightWhite: "#FFFFFF",
      },
    },
    {
      id: "gruvbox", name: "Gruvbox",
      bg: "#282828",
      ui: { bgSidebar: "#1d2021", bgHover: "#3C3836", bgActive: "#504945", text: "#EBDBB2", textDim: "#928374", accent: "#458588", danger: "#CC241D", success: "#98971A", border: "#3C3836" },
      theme: {
        background: "#282828", foreground: "#EBDBB2", cursor: "#EBDBB2",
        selectionBackground: "#3C3836",
        black: "#282828", red: "#CC241D", green: "#98971A", yellow: "#D79921",
        blue: "#458588", magenta: "#B16286", cyan: "#689D6A", white: "#A89984",
        brightBlack: "#928374", brightRed: "#FB4934", brightGreen: "#B8BB26",
        brightYellow: "#FABD2F", brightBlue: "#83A598", brightMagenta: "#D3869B",
        brightCyan: "#8EC07C", brightWhite: "#EBDBB2",
      },
    },
    {
      id: "nord", name: "Nord",
      bg: "#2E3440",
      ui: { bgSidebar: "#2E3440", bgHover: "#3B4252", bgActive: "#434C5E", text: "#D8DEE9", textDim: "#4C566A", accent: "#81A1C1", danger: "#BF616A", success: "#A3BE8C", border: "#3B4252" },
      theme: {
        background: "#2E3440", foreground: "#D8DEE9", cursor: "#D8DEE9",
        selectionBackground: "#434C5E",
        black: "#3B4252", red: "#BF616A", green: "#A3BE8C", yellow: "#EBCB8B",
        blue: "#81A1C1", magenta: "#B48EAD", cyan: "#88C0D0", white: "#E5E9F0",
        brightBlack: "#4C566A", brightRed: "#BF616A", brightGreen: "#A3BE8C",
        brightYellow: "#EBCB8B", brightBlue: "#81A1C1", brightMagenta: "#B48EAD",
        brightCyan: "#8FBCBB", brightWhite: "#ECEFF4",
      },
    },
    {
      id: "one-dark", name: "One Dark",
      bg: "#282C34",
      ui: { bgSidebar: "#21252B", bgHover: "#2c313a", bgActive: "#3E4451", text: "#ABB2BF", textDim: "#5C6370", accent: "#61AFEF", danger: "#E06C75", success: "#98C379", border: "#3E4451" },
      theme: {
        background: "#282C34", foreground: "#ABB2BF", cursor: "#528BFF",
        selectionBackground: "#3E4451",
        black: "#1E2127", red: "#E06C75", green: "#98C379", yellow: "#D19A66",
        blue: "#61AFEF", magenta: "#C678DD", cyan: "#56B6C2", white: "#ABB2BF",
        brightBlack: "#5C6370", brightRed: "#E06C75", brightGreen: "#98C379",
        brightYellow: "#D19A66", brightBlue: "#61AFEF", brightMagenta: "#C678DD",
        brightCyan: "#56B6C2", brightWhite: "#FFFFFF",
      },
    },
    {
      id: "catppuccin", name: "Catppuccin",
      bg: "#1E1E2E",
      ui: { bgSidebar: "#181825", bgHover: "#313244", bgActive: "#45475A", text: "#CDD6F4", textDim: "#585B70", accent: "#89B4FA", danger: "#F38BA8", success: "#A6E3A1", border: "#313244" },
      theme: {
        background: "#1E1E2E", foreground: "#CDD6F4", cursor: "#F5E0DC",
        selectionBackground: "#45475A",
        black: "#45475A", red: "#F38BA8", green: "#A6E3A1", yellow: "#F9E2AF",
        blue: "#89B4FA", magenta: "#F5C2E7", cyan: "#94E2D5", white: "#BAC2DE",
        brightBlack: "#585B70", brightRed: "#F38BA8", brightGreen: "#A6E3A1",
        brightYellow: "#F9E2AF", brightBlue: "#89B4FA", brightMagenta: "#F5C2E7",
        brightCyan: "#94E2D5", brightWhite: "#A6ADC8",
      },
    },
    {
      id: "solarized", name: "Solarized",
      bg: "#002B36",
      ui: { bgSidebar: "#073642", bgHover: "#073642", bgActive: "#586E75", text: "#839496", textDim: "#586E75", accent: "#268BD2", danger: "#DC322F", success: "#859900", border: "#073642" },
      theme: {
        background: "#002B36", foreground: "#839496", cursor: "#839496",
        selectionBackground: "#073642",
        black: "#073642", red: "#DC322F", green: "#859900", yellow: "#B58900",
        blue: "#268BD2", magenta: "#D33682", cyan: "#2AA198", white: "#EEE8D5",
        brightBlack: "#002B36", brightRed: "#CB4B16", brightGreen: "#586E75",
        brightYellow: "#657B83", brightBlue: "#839496", brightMagenta: "#6C71C4",
        brightCyan: "#93A1A1", brightWhite: "#FDF6E3",
      },
    },
    {
      id: "monokai", name: "Monokai",
      bg: "#272822",
      ui: { bgSidebar: "#1e1f1c", bgHover: "#3E3D32", bgActive: "#49483E", text: "#F8F8F2", textDim: "#75715E", accent: "#66D9EF", danger: "#F92672", success: "#A6E22E", border: "#3E3D32" },
      theme: {
        background: "#272822", foreground: "#F8F8F2", cursor: "#F8F8F0",
        selectionBackground: "#49483E",
        black: "#272822", red: "#F92672", green: "#A6E22E", yellow: "#F4BF75",
        blue: "#66D9EF", magenta: "#AE81FF", cyan: "#A1EFE4", white: "#F8F8F2",
        brightBlack: "#75715E", brightRed: "#F92672", brightGreen: "#A6E22E",
        brightYellow: "#F4BF75", brightBlue: "#66D9EF", brightMagenta: "#AE81FF",
        brightCyan: "#A1EFE4", brightWhite: "#F9F8F5",
      },
    },
  ];

  let currentThemeId = localStorage.getItem("termTheme") || "cyber-hud";

  function getCurrentTheme() {
    return COLOR_THEMES.find((t) => t.id === currentThemeId) || COLOR_THEMES[0];
  }

  function applyTheme(themeId) {
    currentThemeId = themeId;
    localStorage.setItem("termTheme", themeId);
    const t = getCurrentTheme();
    // 更新终端颜色
    if (terminal) terminal.options.theme = t.theme;
    // 更新 select overlay 背景
    const overlay = document.getElementById("select-overlay");
    if (overlay) overlay.style.background = t.theme.background;
    // 更新所有 CSS 变量
    const root = document.documentElement.style;
    root.setProperty("--bg", t.theme.background);
    if (t.ui) {
      root.setProperty("--bg-sidebar", t.ui.bgSidebar);
      root.setProperty("--bg-hover", t.ui.bgHover);
      root.setProperty("--bg-active", t.ui.bgActive);
      root.setProperty("--text", t.ui.text);
      root.setProperty("--text-dim", t.ui.textDim);
      root.setProperty("--accent", t.ui.accent);
      root.setProperty("--danger", t.ui.danger);
      root.setProperty("--success", t.ui.success);
      root.setProperty("--border", t.ui.border);
      root.setProperty("--warning", t.ui.warning || t.ui.accent);
    }
  }

  // --- Visual Viewport: 键盘弹出时整体收缩，避免快捷键栏被遮住 ---
  const appEl = document.getElementById("app");

  function applyViewportHeight() {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    // 让 #app 跟随可视区域高度，键盘弹出时自动收缩
    appEl.style.height = vv.height + "px";
    // visualViewport 滚动偏移（iOS 键盘弹出时页面会上移）
    appEl.style.transform = `translateY(${vv.offsetTop}px)`;
    if (fitAddon && terminal) {
      requestAnimationFrame(() => fitAddon.fit());
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyViewportHeight);
    window.visualViewport.addEventListener("scroll", applyViewportHeight);
    applyViewportHeight();
  }

  // DOM refs
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const sessionList = document.getElementById("session-list");
  const terminalContainer = document.getElementById("terminal-container");
  const noSession = document.getElementById("no-session");
  const toolbarTitle = document.getElementById("toolbar-title");
  const statusDot = document.getElementById("status-dot");
  const menuToggle = document.getElementById("menu-toggle");

  function sendCtrl(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(CTRL_PREFIX + JSON.stringify(obj));
    }
  }

  // --- Sidebar Toggle (mobile) ---
  function toggleSidebar(open) {
    sidebarOpen = open !== undefined ? open : !sidebarOpen;
    sidebar.classList.toggle("open", sidebarOpen);
    sidebarOverlay.classList.toggle("open", sidebarOpen);
  }

  menuToggle.addEventListener("click", () => toggleSidebar());
  sidebarOverlay.addEventListener("click", () => toggleSidebar(false));

  // --- Parse incoming message ---
  function parseMessage(data) {
    if (typeof data === "string" && data[0] === CTRL_PREFIX) {
      try {
        return { ctrl: true, msg: JSON.parse(data.slice(1)) };
      } catch {
        return { ctrl: false, data };
      }
    }
    return { ctrl: false, data };
  }

  // --- Lobby WebSocket (session list updates) ---
  // 初始加载完成标记，避免 lobby 推送覆盖初始 fetch 结果
  let initialLoadDone = false;

  function connectLobby() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    lobbyWs = new WebSocket(`${proto}//${location.host}`);

    lobbyWs.onmessage = (e) => {
      const parsed = parseMessage(e.data);
      if (!parsed.ctrl) return;
      const msg = parsed.msg;
      if (msg.type === "sessions") {
        // 初始加载未完成时忽略 lobby 推送，避免竞争
        if (!initialLoadDone) return;
        sessions = msg.data;
        renderSessionList();
      } else if (msg.type === "created") {
        switchSession(msg.data.id);
      } else if (msg.type === "notification") {
        addNotification(msg);
      }
    };

    lobbyWs.onclose = () => {
      setTimeout(connectLobby, 3000);
    };
  }

  // --- Session List Rendering ---
  function renderSessionList() {
    sessionList.innerHTML = "";
    sessions.forEach((s) => {
      const div = document.createElement("div");
      const unread = hasSessionUnread(s.id);
      div.className = "session-item" + (s.id === activeSessionId ? " active" : "") + (unread ? " session-breathing" : "");
      const bellHtml = unread ? `<span class="session-bell-icon bell-shaking">${SVG.bell}</span>` : "";
      div.innerHTML = `
        <div class="session-info">
          <div class="session-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}${bellHtml}</div>
          <div class="session-meta">${formatTime(s.createdAt)} · ${s.clients} conn</div>
        </div>
        <div class="session-actions">
          <button class="btn-icon" data-action="rename" data-id="${s.id}" title="Rename">${SVG.edit}</button>
          <button class="btn-icon danger" data-action="close" data-id="${s.id}" title="Close">${SVG.close}</button>
        </div>
      `;
      div.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        switchSession(s.id);
        toggleSidebar(false);
      });
      sessionList.appendChild(div);
    });

    sessionList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "close") closeSession(id);
        else if (action === "rename") renameSession(id);
      });
    });
  }

  // --- Session Actions ---
  async function createSession(name, cwd, initCmd, aiTool) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, cwd: cwd || undefined, initCmd: initCmd || undefined, aiTool: aiTool || undefined }),
    });
    const data = await res.json();
    switchSession(data.id);
    toggleSidebar(false);
  }

  // --- New Session Wizard ---
  const wizardModal = document.getElementById("wizard-modal");
  const wizardTitle = document.getElementById("wizard-title");
  const wizardBody = document.getElementById("wizard-body");
  const wizardFooter = document.getElementById("wizard-footer");
  const wizardSkip = document.getElementById("wizard-skip");
  const wizardBack = document.getElementById("wizard-back");
  const wizardNext = document.getElementById("wizard-next");
  const wizardClose = document.getElementById("wizard-close");

  const wizard = {
    step: 0,           // 0=dir, 1=ai-tool
    selectedDir: null, // string path or null
    aiTool: null,      // 'claude' | 'codex' | null
    aiOpts: {},        // { maxPermission, continueConv, ... }
  };

  function openWizard() {
    wizard.step = 0;
    wizard.selectedDir = null;
    wizard.aiTool = null;
    wizard.aiOpts = {};
    toggleSidebar(false);
    wizardModal.style.display = "flex";
    renderWizardStep();
  }

  function closeWizard() {
    wizardModal.style.display = "none";
  }

  wizardClose.addEventListener("click", closeWizard);
  wizardModal.addEventListener("click", (e) => { if (e.target === wizardModal) closeWizard(); });

  wizardSkip.addEventListener("click", () => {
    if (wizard.step === 0) {
      // 跳过目录选择，直接进入 AI 工具步骤
      wizard.selectedDir = null;
      wizard.step = 1;
      renderWizardStep();
    } else {
      // 跳过 AI 工具，直接创建
      finishWizard();
    }
  });

  wizardBack.addEventListener("click", () => {
    if (wizard.step > 0) { wizard.step--; renderWizardStep(); }
  });

  wizardNext.addEventListener("click", () => {
    if (wizard.step === 0) {
      wizard.step = 1;
      renderWizardStep();
    } else {
      finishWizard();
    }
  });

  function renderWizardStep() {
    wizardBody.innerHTML = "";
    wizardBack.style.display = wizard.step > 0 ? "inline-flex" : "none";

    // Step indicator
    const dots = document.createElement("div");
    dots.className = "wizard-step-indicator";
    for (let i = 0; i < 2; i++) {
      const d = document.createElement("div");
      d.className = "wizard-step-dot" + (i < wizard.step ? " done" : i === wizard.step ? " active" : "");
      dots.appendChild(d);
    }
    wizardBody.appendChild(dots);

    if (wizard.step === 0) {
      wizardTitle.textContent = "选择工作目录";
      wizardSkip.textContent = "跳过";
      wizardNext.textContent = "下一步 →";
      renderDirStep();
    } else {
      wizardTitle.textContent = "启动 AI 工具（可选）";
      wizardSkip.textContent = "跳过，直接创建";
      wizardNext.textContent = "创建会话 ✓";
      renderAiStep();
    }
  }

  function syncWizardNextBtn() {
    if (wizard.step !== 0) return;
    if (wizard.selectedDir) {
      wizardNext.textContent = "下一步 (" + wizard.selectedDir.split("/").pop() + ") →";
    } else {
      wizardNext.textContent = "下一步 →";
    }
  }

  // ---- Step 1: Directory Browser ----
  let dirBrowserPath = null; // current browse path

  async function renderDirStep() {
    const wrap = document.createElement("div");
    wrap.className = "dir-browser";
    wizardBody.appendChild(wrap);

    // 初始路径
    if (!dirBrowserPath) {
      try {
        const r = await fetch("/api/dirs");
        const d = await r.json();
        dirBrowserPath = d.current;
      } catch { dirBrowserPath = "/"; }
    }
    loadDirBrowser(wrap, dirBrowserPath);
  }

  async function loadDirBrowser(wrap, dirPath) {
    wrap.innerHTML = '<div class="shortcut-loading" style="padding:8px">加载中…</div>';
    dirBrowserPath = dirPath;

    let data;
    try {
      const r = await fetch("/api/dirs?path=" + encodeURIComponent(dirPath));
      data = await r.json();
    } catch {
      wrap.innerHTML = '<span class="shortcut-error">加载失败</span>';
      return;
    }

    wrap.innerHTML = "";

    // 路径栏
    const pathBar = document.createElement("div");
    pathBar.className = "dir-path-bar";
    if (data.parent !== null) {
      const upBtn = document.createElement("button");
      upBtn.className = "dir-back-btn";
      upBtn.title = "上级目录";
      upBtn.innerHTML = "&#8592; 返回";
      upBtn.addEventListener("click", () => loadDirBrowser(wrap, data.parent));
      pathBar.appendChild(upBtn);
    }
    const pathText = document.createElement("span");
    pathText.textContent = data.current;
    pathText.style.flex = "1";
    pathText.style.minWidth = "0";
    pathText.style.overflow = "hidden";
    pathText.style.textOverflow = "ellipsis";
    pathText.style.whiteSpace = "nowrap";
    pathBar.appendChild(pathText);
    wrap.appendChild(pathBar);

    // 目录列表
    const list = document.createElement("div");
    list.className = "dir-list";

    if (data.dirs.length === 0) {
      list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:12px">（空目录）</div>';
    }

    data.dirs.forEach((d) => {
      const item = document.createElement("div");
      item.className = "dir-item" + (d.hidden ? " hidden-dir" : "") + (wizard.selectedDir === d.path ? " selected" : "");
      item.innerHTML = `<span class="dir-icon">${SVG.dirFolder}</span><span class="dir-name">${escapeHtml(d.name)}</span><span style="color:var(--text-dim);font-size:12px">›</span>`;

      // 单击选中，双击进入
      let clickTimer = null;
      item.addEventListener("click", () => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          loadDirBrowser(wrap, d.path);
          return;
        }
        clickTimer = setTimeout(() => {
          clickTimer = null;
          // 选中/取消
          wizard.selectedDir = wizard.selectedDir === d.path ? null : d.path;
          wrap.querySelectorAll(".dir-item").forEach((el) => el.classList.remove("selected"));
          if (wizard.selectedDir) item.classList.add("selected");
          // 同步更新"使用当前目录"按钮状态
          const curBtn = wrap.querySelector(".btn-secondary");
          if (curBtn) {
            if (wizard.selectedDir) {
              curBtn.textContent = "\u2713 \u5DF2\u9009\uFF1A" + wizard.selectedDir.split("/").pop();
              curBtn.style.borderColor = "var(--accent)";
              curBtn.style.color = "var(--accent)";
            } else {
              curBtn.textContent = "\u2713 \u4F7F\u7528\u5F53\u524D\u76EE\u5F55";
              curBtn.style.borderColor = "";
              curBtn.style.color = "";
            }
          }
          // 同步更新 Next 按钮状态
          syncWizardNextBtn();
        }, 220);
      });
      list.appendChild(item);
    });

    wrap.appendChild(list);

    // 说明：单击选中，双击进入
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:11px;color:var(--text-dim);padding:0 2px";
    hint.textContent = "单击选中目录 · 双击进入 · 未选则使用当前目录";
    wrap.appendChild(hint);

    // 当前目录快速选中按钮
    const selectCurrentBtn = document.createElement("button");
    selectCurrentBtn.className = "btn-secondary";
    selectCurrentBtn.style.cssText = "font-size:12px;padding:6px 12px;align-self:flex-start";
    selectCurrentBtn.textContent = "✓ 使用当前目录";
    selectCurrentBtn.addEventListener("click", () => {
      wizard.selectedDir = data.current;
      wrap.querySelectorAll(".dir-item").forEach((el) => el.classList.remove("selected"));
      selectCurrentBtn.textContent = "✓ 已选：" + data.current.split("/").pop();
      selectCurrentBtn.style.borderColor = "var(--accent)";
      selectCurrentBtn.style.color = "var(--accent)";
      syncWizardNextBtn();
    });
    wrap.appendChild(selectCurrentBtn);
    if (wizard.selectedDir === data.current) {
      selectCurrentBtn.textContent = "✓ 已选：" + data.current.split("/").pop();
      selectCurrentBtn.style.borderColor = "var(--accent)";
      selectCurrentBtn.style.color = "var(--accent)";
    }

    // 新建目录
    const newRow = document.createElement("div");
    newRow.className = "dir-new-row";
    const newInput = document.createElement("input");
    newInput.placeholder = "新建目录名…";
    newInput.type = "text";
    const newBtn = document.createElement("button");
    newBtn.textContent = "创建";
    newBtn.addEventListener("click", async () => {
      const name = newInput.value.trim();
      if (!name) return;
      const newPath = data.current.replace(/\/$/, "") + "/" + name;
      try {
        const r = await fetch("/api/dirs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: newPath }),
        });
        const res = await r.json();
        if (res.path) {
          wizard.selectedDir = res.path;
          loadDirBrowser(wrap, data.current);
        }
      } catch {}
    });
    newInput.addEventListener("keydown", (e) => { if (e.key === "Enter") newBtn.click(); });
    newRow.appendChild(newInput);
    newRow.appendChild(newBtn);
    wrap.appendChild(newRow);
  }

  // ---- Step 2: AI Tool ----
  function renderAiStep() {
    const wrap = document.createElement("div");
    wizardBody.appendChild(wrap);

    const title = document.createElement("div");
    title.className = "wizard-section-title";
    title.textContent = "选择要启动的 AI 工具";
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "ai-tool-grid";

    // Claude card
    const claudeCard = document.createElement("div");
    claudeCard.className = "ai-tool-card" + (wizard.aiTool === "claude" ? " selected" : "");
    claudeCard.innerHTML = `<h4>${SVG.claude} Claude</h4><p>Anthropic Claude Code CLI，适合代码生成与分析</p>`;
    claudeCard.addEventListener("click", () => {
      wizard.aiTool = wizard.aiTool === "claude" ? null : "claude";
      renderAiStep._refresh(wrap);
    });

    // Codex card
    const codexCard = document.createElement("div");
    codexCard.className = "ai-tool-card" + (wizard.aiTool === "codex" ? " selected-codex" : "");
    codexCard.innerHTML = `<h4>${SVG.codex} Codex</h4><p>OpenAI Codex CLI，适合快速命令行任务执行</p>`;
    codexCard.addEventListener("click", () => {
      wizard.aiTool = wizard.aiTool === "codex" ? null : "codex";
      renderAiStep._refresh(wrap);
    });

    grid.appendChild(claudeCard);
    grid.appendChild(codexCard);
    wrap.appendChild(grid);

    // None option
    const noneBtn = document.createElement("div");
    noneBtn.className = "ai-tool-none" + (wizard.aiTool === null ? " selected" : "");
    noneBtn.textContent = "不启动 AI 工具，仅创建终端";
    noneBtn.addEventListener("click", () => { wizard.aiTool = null; renderAiStep._refresh(wrap); });
    wrap.appendChild(noneBtn);

    // Options based on selected tool
    const optsSection = document.createElement("div");
    optsSection.className = "ai-opts-section" + (wizard.aiTool ? " visible" : "");
    wrap.appendChild(optsSection);

    if (wizard.aiTool === "claude") {
      renderClaudeOpts(optsSection);
    } else if (wizard.aiTool === "codex") {
      renderCodexOpts(optsSection);
    }

    renderAiStep._refresh = (container) => {
      container.innerHTML = "";
      renderAiStep();
    };
  }

  function renderClaudeOpts(container) {
    const label = document.createElement("div");
    label.className = "ai-opts-label";
    label.textContent = "Claude 启动参数";
    container.appendChild(label);

    const opts = [
      {
        key: "dangerouslySkipPermissions",
        label: "最大权限模式",
        desc: "--dangerously-skip-permissions  跳过所有权限确认",
      },
      {
        key: "continue",
        label: "继续上次对话",
        desc: "--continue  恢复最近的会话",
      },
      {
        key: "verbose",
        label: "详细输出",
        desc: "--verbose  显示完整执行细节",
      },
    ];

    if (!wizard.aiOpts.claude) wizard.aiOpts.claude = {};

    opts.forEach(({ key, label: lbl, desc }) => {
      const row = document.createElement("div");
      row.className = "ai-opt-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "claude-opt-" + key;
      cb.checked = !!wizard.aiOpts.claude[key];
      cb.addEventListener("change", () => { wizard.aiOpts.claude[key] = cb.checked; });
      const labelEl = document.createElement("label");
      labelEl.innerHTML = `${escapeHtml(lbl)}<span>${escapeHtml(desc)}</span>`;
      row.appendChild(cb);
      row.appendChild(labelEl);
      const labelEl2 = labelEl; // avoid re-reference
      labelEl2.addEventListener("click", () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); });
      container.appendChild(row);
    });
  }

  function renderCodexOpts(container) {
    const label = document.createElement("div");
    label.className = "ai-opts-label";
    label.textContent = "Codex 启动参数";
    container.appendChild(label);

    const opts = [
      {
        key: "fullAuto",
        label: "全自动模式",
        desc: "--full-auto  自动执行，启用工作区写入沙箱",
      },
      {
        key: "dangerouslyBypassApprovals",
        label: "最大权限模式",
        desc: "--dangerously-bypass-approvals-and-sandbox  跳过所有确认且无沙箱（谨慎使用）",
      },
      {
        key: "quiet",
        label: "静默模式",
        desc: "--quiet  减少输出噪音",
      },
    ];

    if (!wizard.aiOpts.codex) wizard.aiOpts.codex = {};

    opts.forEach(({ key, label: lbl, desc }) => {
      const row = document.createElement("div");
      row.className = "ai-opt-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "codex-opt-" + key;
      cb.checked = !!wizard.aiOpts.codex[key];
      cb.addEventListener("change", () => { wizard.aiOpts.codex[key] = cb.checked; });
      const labelEl = document.createElement("label");
      labelEl.innerHTML = `${escapeHtml(lbl)}<span>${escapeHtml(desc)}</span>`;
      row.appendChild(cb);
      row.appendChild(labelEl);
      const labelEl2 = labelEl; // avoid re-reference
      labelEl2.addEventListener("click", () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); });
      container.appendChild(row);
    });
  }

  function buildInitCmd() {
    if (!wizard.aiTool) return null;
    if (wizard.aiTool === "claude") {
      const opts = wizard.aiOpts.claude || {};
      const args = ["claude"];
      if (opts.dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (opts.continue) args.push("--continue");
      if (opts.verbose) args.push("--verbose");
      return args.join(" ");
    }
    if (wizard.aiTool === "codex") {
      const opts = wizard.aiOpts.codex || {};
      const args = ["codex"];
      if (opts.fullAuto) args.push("--full-auto");
      if (opts.dangerouslyBypassApprovals) args.push("--dangerously-bypass-approvals-and-sandbox");
      if (opts.quiet) args.push("--quiet");
      return args.join(" ");
    }
    return null;
  }

  function buildSessionName() {
    const dirPart = wizard.selectedDir ? wizard.selectedDir.split("/").pop() : null;
    const toolPart = wizard.aiTool;
    if (dirPart && toolPart) return `${toolPart}@${dirPart}`;
    if (dirPart) return dirPart;
    if (toolPart) return toolPart;
    return undefined;
  }

  async function finishWizard() {
    closeWizard();
    const initCmd = buildInitCmd();
    const name = buildSessionName();
    await createSession(name, wizard.selectedDir || undefined, initCmd, wizard.aiTool || undefined);
  }

  async function closeSession(id) {
    if (!confirm("Close this session?")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    sessionFileTreeRoots.delete(id);
    sessionCwds.delete(id);
    if (id === activeSessionId) {
      disconnectTerminal();
      activeSessionId = null;
      updateMainView();
    }
  }

  function renameSession(id) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    const nameEl = [...sessionList.querySelectorAll(".session-item")].find(
      (el) => el.querySelector(`[data-id="${id}"]`)
    );
    if (!nameEl) return;

    const nameDiv = nameEl.querySelector(".session-name");
    const oldName = session.name;
    nameDiv.innerHTML = `<input class="rename-input" value="${escapeHtml(oldName)}" />`;
    const input = nameDiv.querySelector("input");
    input.focus();
    input.select();

    const finish = async () => {
      const newName = input.value.trim() || oldName;
      if (newName !== oldName) {
        await fetch(`/api/sessions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
      }
      nameDiv.textContent = newName;
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = oldName;
        input.blur();
      }
    });
  }

  // --- Terminal Connection ---
  function switchSession(id) {
    if (id === activeSessionId) return;
    // Save current file tree root before switching
    if (activeSessionId && fileTreeRoot) {
      sessionFileTreeRoots.set(activeSessionId, fileTreeRoot);
    }
    // Close editor if open
    if (typeof closeEditor === "function" && document.getElementById("editor-container").style.display !== "none") {
      if (editorView) { editorView.destroy(); editorView = null; }
      document.getElementById("editor-area").innerHTML = "";
      document.getElementById("editor-container").style.display = "none";
    }
    disconnectTerminal();
    activeSessionId = id;
    // Mark all notifications for this session as read
    markSessionAsRead(id);
    renderSessionList();
    updateMainView();
    connectTerminal(id);
    // 快捷键栏已打开时，切换 session 后立刻重建固定行（tmux/非tmux 按钮不同）
    if (shortcutBarOpen) {
      buildFixedRow();
    }
    // Refresh file tree if Files tab active
    if (activeSidebarTab === "files") loadFileTreeForSession();
  }

  function updateMainView() {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) {
      terminalContainer.style.display = "block";
      noSession.style.display = "none";
      toolbarTitle.textContent = session.name;
      toolbarTitle.title = session.name;
    } else if (activeSessionId) {
      // activeSessionId 已设置但 sessions 还没同步到，保持当前视图不变
      // 避免 terminalContainer 和 noSession 同时显示
    } else {
      terminalContainer.style.display = "none";
      noSession.style.display = "flex";
      toolbarTitle.textContent = "Web Terminal";
      toolbarTitle.title = "";
      statusDot.className = "";
      statusDot.style.display = "none";
    }
  }

  function connectTerminal(sessionId) {
    if (terminal) {
      terminal.dispose();
    }

    terminal = new Terminal({
      cursorBlink: true,
      fontSize: currentFontSize,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', monospace",
      theme: getCurrentTheme().theme,
      allowProposedApi: true,
      scrollback: 5000,
    });

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon.WebLinksAddon());

    // Ensure container is visible and has dimensions before opening terminal
    terminalContainer.style.display = "block";

    terminal.open(terminalContainer);

    // Delay fit — on mobile Chrome the container may not have final dimensions yet.
    // Use double-rAF to ensure layout is fully resolved after display:block.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (fitAddon && terminal) {
          fitAddon.fit();
        }
      });
    });

    // WebSocket
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    termWs = new WebSocket(`${proto}//${location.host}?session=${sessionId}`);

    statusDot.style.display = "block";
    statusDot.className = "connecting";

    termWs.onopen = () => {
      statusDot.className = "";
      sendCtrl(termWs, { type: "resize", cols: terminal.cols, rows: terminal.rows });
    };

    termWs.onmessage = (e) => {
      const parsed = parseMessage(e.data);
      if (parsed.ctrl) {
        const msg = parsed.msg;
        if (msg.type === "exit") {
          terminal.writeln("\r\n\x1b[31m[Session ended]\x1b[0m");
          statusDot.className = "disconnected";
        } else if (msg.type === "sessions") {
          sessions = msg.data;
          renderSessionList();
        } else if (msg.type === "notification") {
          addNotification(msg);
        }
      } else {
        // Raw terminal data — write directly
        terminal.write(parsed.data);
      }
    };

    termWs.onclose = () => {
      statusDot.className = "disconnected";
      if (activeSessionId === sessionId) {
        reconnectTimer = setTimeout(() => {
          if (activeSessionId === sessionId) {
            connectTerminal(sessionId);
          }
        }, 2000);
      }
    };

    termWs.onerror = () => {
      statusDot.className = "disconnected";
    };

    // Terminal input -> WebSocket as raw string (no JSON wrapping)
    terminal.onData((data) => {
      if (termWs && termWs.readyState === WebSocket.OPEN) {
        termWs.send(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon) {
        fitAddon.fit();
        sendCtrl(termWs, { type: "resize", cols: terminal.cols, rows: terminal.rows });
      }
    });
    resizeObserver.observe(terminalContainer);

    terminal.focus();

    // Touch: inertia scroll + pinch-to-zoom on mobile
    setupTouchHandlers(terminalContainer);

    // Copy on xterm internal selection (desktop mouse drag)
    terminal.onSelectionChange(() => {
      if (selectMode) return; // In select mode, use native selection instead
      const sel = terminal.getSelection();
      if (sel && navigator.clipboard) {
        navigator.clipboard.writeText(sel).then(showCopyToast).catch(() => {});
      }
    });
  }

  function disconnectTerminal() {
    clearTimeout(reconnectTimer);
    if (termWs) {
      termWs.onclose = null;
      termWs.close();
      termWs = null;
    }
    if (terminal) {
      terminal.dispose();
      terminal = null;
      fitAddon = null;
    }
    terminalContainer.innerHTML = "";
  }

  // --- Touch: inertia scroll + pinch-to-zoom ---
  function setupTouchHandlers(container) {
    // pinch state
    let pinching = false;
    let startDist = 0;
    let startFontSize = 0;

    // scroll state
    let scrolling = false;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;        // px/ms
    let rafId = null;
    let accum = 0;            // 累积未消费的像素

    const LINE_HEIGHT = () => (terminal ? terminal.options.fontSize * 1.2 : 18);

    function getTouchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function stopInertia() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      velocityY = 0;
      accum = 0;
    }

    function runInertia() {
      if (Math.abs(velocityY) < 0.02) { stopInertia(); return; }
      // 每帧按 16ms 推进
      accum += velocityY * 16;
      const lineH = LINE_HEIGHT();
      const lines = Math.trunc(accum / lineH);
      if (lines !== 0) {
        accum -= lines * lineH;
        if (terminal) terminal.scrollLines(-lines); // 负号：向上滑 → 内容向上 → scrollLines 正数
      }
      velocityY *= 0.92;  // 摩擦系数，越小停得越快
      rafId = requestAnimationFrame(runInertia);
    }

    container.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        // 双指：捏缩模式，停止惯性
        stopInertia();
        scrolling = false;
        pinching = true;
        startDist = getTouchDist(e.touches);
        startFontSize = currentFontSize;
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1 && !pinching) {
        stopInertia();
        scrolling = true;
        lastY = e.touches[0].clientY;
        lastTime = e.timeStamp;
        velocityY = 0;
        accum = 0;
        // 不 preventDefault：让 xterm 仍能接收 tap/click 以定位光标
      }
    }, { passive: false });

    container.addEventListener("touchmove", (e) => {
      if (pinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const scale = dist / startDist;
        let newSize = Math.round(startFontSize * scale);
        newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newSize));
        if (newSize !== currentFontSize) {
          currentFontSize = newSize;
          updateFontSizeLabel();
          if (terminal) {
            terminal.options.fontSize = newSize;
            if (fitAddon) {
              fitAddon.fit();
              sendCtrl(termWs, { type: "resize", cols: terminal.cols, rows: terminal.rows });
            }
          }
        }
        return;
      }

      if (!scrolling || e.touches.length !== 1 || !terminal) return;
      e.preventDefault(); // 阻止页面滚动，我们自己处理

      const y = e.touches[0].clientY;
      const dt = e.timeStamp - lastTime || 1;
      const dy = y - lastY;   // 手指向下 dy>0 → 内容向下

      // tmux 会话：发送上/下方向键给 tmux，而非操作本地 scrollback。
      // tmux 在普通模式下方向键可以滚动历史（如果 set -g mouse on），
      // 这里用最兼容的方式：发送 legacy mouse wheel escape sequences。
      // Button 64 = wheel up, 65 = wheel down; col/row 用 33(=1) 编码
      if (isTmuxSession()) {
        accum += dy;
        const lineH = LINE_HEIGHT();
        const lines = Math.trunc(accum / lineH);
        if (lines !== 0) {
          accum -= lines * lineH;
          const count = Math.abs(lines);
          // Legacy mouse encoding: \x1b[M + (button+32) + (col+32) + (row+32)
          // Wheel up = button 64, wheel down = button 65
          const btn = lines > 0 ? 64 : 65; // dy>0 手指下滑 → scroll up(64)
          const seq = "\x1b[M" + String.fromCharCode(btn + 32) + String.fromCharCode(33) + String.fromCharCode(33);
          for (let i = 0; i < count; i++) sendRaw(seq);
        }
        lastY = y;
        lastTime = e.timeStamp;
        return;
      }

      // 指数平滑速度（px/ms）
      const instantV = dy / dt;
      velocityY = velocityY * 0.6 + instantV * 0.4;

      // 直接滚动
      accum += dy;
      const lineH = LINE_HEIGHT();
      const lines = Math.trunc(accum / lineH);
      if (lines !== 0) {
        accum -= lines * lineH;
        terminal.scrollLines(-lines);
      }

      lastY = y;
      lastTime = e.timeStamp;
    }, { passive: false });

    container.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinching = false;

      if (scrolling && e.touches.length === 0) {
        scrolling = false;
        // tmux 会话不启动惯性滚动，由 tmux 自行处理
        if (isTmuxSession()) return;
        // 抬手时如果有速度则启动惯性
        if (Math.abs(velocityY) > 0.05) {
          rafId = requestAnimationFrame(runInertia);
        }
      }
    });

    container.addEventListener("touchcancel", () => {
      pinching = false;
      scrolling = false;
      stopInertia();
    });
  }

  // --- Helpers ---
  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function isMobile() {
    return window.innerWidth <= 768;
  }

  // --- Select mode ---
  // On mobile, xterm intercepts all touch events so native text selection is impossible.
  // Solution: overlay a plain <pre> with terminal text content on top of the terminal.
  // Users can then long-press / drag to select and copy using the browser's native behavior.
  let selectMode = false;
  const selectModeBtn = document.getElementById("select-mode-btn");
  const copyToast = document.getElementById("copy-toast");
  let selectOverlay = null;

  function getTerminalText() {
    if (!terminal) return "";
    const lines = [];
    const buf = terminal.buffer.active;
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    return lines.join("\n");
  }

  function toggleSelectMode() {
    selectMode = !selectMode;
    selectModeBtn.classList.toggle("active", selectMode);

    if (selectMode) {
      // 隐藏 xterm canvas 层，避免两层叠加和 touch 事件冲突
      const xtermEl = terminalContainer.querySelector(".xterm");
      if (xtermEl) xtermEl.style.visibility = "hidden";

      // 创建纯文本 overlay，包含完整 scrollback 内容
      selectOverlay = document.createElement("pre");
      selectOverlay.id = "select-overlay";
      selectOverlay.textContent = getTerminalText();
      terminalContainer.appendChild(selectOverlay);

      // 滚动到底部（最新内容）
      requestAnimationFrame(() => {
        selectOverlay.scrollTop = selectOverlay.scrollHeight;
      });
    } else {
      // 恢复 xterm 显示
      const xtermEl = terminalContainer.querySelector(".xterm");
      if (xtermEl) xtermEl.style.visibility = "";

      if (selectOverlay) {
        selectOverlay.remove();
        selectOverlay = null;
      }
      window.getSelection()?.removeAllRanges();
      if (terminal) terminal.focus();
    }
  }

  function showCopyToast() {
    copyToast.classList.add("show");
    setTimeout(() => copyToast.classList.remove("show"), 1200);
  }

  selectModeBtn.addEventListener("click", toggleSelectMode);

  // Auto-copy when user finishes selecting text in overlay
  document.addEventListener("selectionchange", () => {
    if (!selectMode) return;
    // Debounce: copy after selection stabilizes
    clearTimeout(selectModeBtn._copyTimer);
    selectModeBtn._copyTimer = setTimeout(() => {
      const sel = window.getSelection()?.toString();
      if (sel && navigator.clipboard) {
        navigator.clipboard.writeText(sel).then(showCopyToast).catch(() => {});
      }
    }, 500);
  });

  // --- Font size controls ---
  const fontSizeLabel = document.getElementById("font-size-label");

  function updateFontSizeLabel() {
    fontSizeLabel.textContent = currentFontSize + "px";
  }

  function changeFontSize(delta) {
    const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentFontSize + delta));
    if (newSize === currentFontSize) return;
    currentFontSize = newSize;
    updateFontSizeLabel();
    if (terminal) {
      terminal.options.fontSize = newSize;
      if (fitAddon) {
        fitAddon.fit();
        sendCtrl(termWs, { type: "resize", cols: terminal.cols, rows: terminal.rows });
      }
    }
  }

  updateFontSizeLabel();

  // --- Attach Modal ---
  const attachModal = document.getElementById("attach-modal");
  const attachLoading = document.getElementById("attach-loading");
  const attachContent = document.getElementById("attach-content");
  const tmuxList = document.getElementById("tmux-list");
  const attachEmpty = document.getElementById("attach-empty");

  function openAttachModal() {
    attachModal.style.display = "flex";
    attachLoading.style.display = "block";
    attachContent.style.display = "none";
    toggleSidebar(false);
    scanExternal();
  }

  function closeAttachModal() {
    attachModal.style.display = "none";
  }

  async function scanExternal() {
    try {
      const res = await fetch("/api/external");
      const data = await res.json();
      renderAttachList(data);
    } catch {
      attachLoading.textContent = "Scan failed.";
    }
  }

  function renderAttachList(data) {
    attachLoading.style.display = "none";
    attachContent.style.display = "block";
    tmuxList.innerHTML = "";

    const hasTmux = data.tmux && data.tmux.length > 0;
    attachEmpty.style.display = hasTmux ? "none" : "block";

    if (hasTmux) {
      data.tmux.forEach((ts) => {
        const div = document.createElement("div");
        div.className = "tmux-session";

        const badge = ts.attached
          ? '<span class="badge attached">attached</span>'
          : '<span class="badge">detached</span>';

        let html = `<div class="tmux-session-header">${escapeHtml(ts.name)} ${badge} <span class="badge">${ts.windows} win</span></div>`;

        ts.windowList.forEach((w) => {
          html += `
            <div class="tmux-window" data-session="${escapeHtml(ts.name)}" data-window="${w.index}">
              <div class="tmux-window-info">
                <span class="tmux-window-idx">#${w.index}</span>
                <span class="tmux-window-name">${escapeHtml(w.name)}</span>
                <span class="tmux-window-cmd">${escapeHtml(w.command)}</span>
              </div>
              <span class="attach-action">Attach</span>
            </div>
          `;
        });

        div.innerHTML = html;
        tmuxList.appendChild(div);
      });

      tmuxList.querySelectorAll(".tmux-window").forEach((el) => {
        el.addEventListener("click", () => {
          attachTmux(el.dataset.session, Number(el.dataset.window));
        });
      });
    }
  }

  async function attachTmux(sessionName, windowIdx) {
    closeAttachModal();
    try {
      const res = await fetch("/api/attach/tmux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: sessionName, window: windowIdx }),
      });
      const data = await res.json();
      if (data.id) {
        switchSession(data.id);
      }
    } catch {}
  }

  document.getElementById("attach-btn").addEventListener("click", openAttachModal);
  document.getElementById("attach-modal-close").addEventListener("click", closeAttachModal);
  attachModal.addEventListener("click", (e) => {
    if (e.target === attachModal) closeAttachModal();
  });

  // --- Button bindings ---
  document.getElementById("new-session-btn").addEventListener("click", openWizard);
  document.getElementById("no-session-btn").addEventListener("click", openWizard);
  document.getElementById("font-inc").addEventListener("click", () => changeFontSize(2));
  document.getElementById("font-dec").addEventListener("click", () => changeFontSize(-2));

  // --- 会话名展开/截断切换 ---
  const nameExpandBtn = document.getElementById("name-expand-btn");
  let namesExpanded = false;
  nameExpandBtn.addEventListener("click", () => {
    namesExpanded = !namesExpanded;
    appEl.classList.toggle("names-expanded", namesExpanded);
    nameExpandBtn.classList.toggle("active", namesExpanded);
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "T") {
      e.preventDefault();
      openWizard();
    }
  });

  // --- AI Shortcut Bar ---
  const shortcutToggleBtn = document.getElementById("shortcut-toggle-btn");
  const shortcutBar = document.getElementById("shortcut-bar");
  const shortcutKeys = document.getElementById("shortcut-keys");
  const shortcutRefreshBtn = document.getElementById("shortcut-refresh-btn");
  let aiEnabled = false; // 由 /api/config 决定，默认关闭

  // 获取终端当前可见的最后 N 行文本（去掉 ANSI 转义序列）
  function getTerminalVisibleLines(maxLines = 30) {
    if (!terminal) return "";
    const buf = terminal.buffer.active;
    const totalLines = buf.length;
    const start = Math.max(0, totalLines - maxLines);
    const lines = [];
    for (let i = start; i < totalLines; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    // 去掉末尾空行
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.join("\n");
  }

  // 将快捷键 label 映射到实际发送的字节序列
  // AI 返回 sequence 字段，这里作为兜底
  const SEQUENCE_MAP = {
    "ctrl+c": "\x03",
    "ctrl+d": "\x04",
    "ctrl+z": "\x1a",
    "ctrl+l": "\x0c",
    "ctrl+r": "\x12",
    "ctrl+a": "\x01",
    "ctrl+e": "\x05",
    "ctrl+k": "\x0b",
    "ctrl+u": "\x15",
    "ctrl+w": "\x17",
    "ctrl+p": "\x10",
    "ctrl+n": "\x0e",
    "ctrl+f": "\x06",
    "ctrl+b": "\x02",
    "ctrl+\\": "\x1c",
    "escape": "\x1b",
    "esc": "\x1b",
    "tab": "\x09",
    "enter": "\r",
    "up": "\x1b[A",
    "down": "\x1b[B",
    "left": "\x1b[D",
    "right": "\x1b[C",
    "↑": "\x1b[A",
    "↓": "\x1b[B",
  };

  function resolveSequence(label, sequence) {
    if (sequence) return sequence;
    const key = label.toLowerCase().trim();
    return SEQUENCE_MAP[key] || null;
  }

  function sendShortcut(label, sequence) {
    const seq = resolveSequence(label, sequence);
    if (!seq) return;
    if (termWs && termWs.readyState === WebSocket.OPEN) {
      termWs.send(seq);
    }
    if (terminal) terminal.focus();
  }

  // --- Shortcut Bar ---

  const shortcutFixedRow = document.getElementById("shortcut-fixed-row");
  const shortcutAiKeys   = document.getElementById("shortcut-ai-keys");

  function isTmuxSession() {
    const session = sessions.find((s) => s.id === activeSessionId);
    return !!(session && session.name.startsWith("tmux:"));
  }

  function getSessionAiTool() {
    const session = sessions.find((s) => s.id === activeSessionId);
    return session ? (session.aiTool || null) : null;
  }

  // 每次调用时实时读取 termWs，不在创建按钮时捕获
  function sendRaw(data) {
    if (termWs && termWs.readyState === WebSocket.OPEN) termWs.send(data);
    if (terminal) terminal.focus();
  }

  // tmux: prefix(Ctrl+B) 和命令字符分两次发，中间留 100ms（移动端延迟较大）
  function sendTmuxCmd(cmdChar) {
    sendRaw("\x02");
    setTimeout(() => sendRaw(cmdChar), 100);
  }

  // tmux copy-mode 命令：通过服务端 API 直接执行，自动进入 copy-mode
  function sendTmuxCopyCmd(command) {
    if (!activeSessionId) return;
    fetch("/api/tmux/send-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: activeSessionId, command }),
    }).catch(() => {});
  }

  function makeBtn(label, desc, handler, extraClass) {
    const btn = document.createElement("button");
    btn.className = "shortcut-key-btn" + (extraClass ? " " + extraClass : "");
    btn.title = desc || label;
    btn.innerHTML = `<span class="key-label">${escapeHtml(label)}</span>` +
      (desc ? `<span class="key-desc">${escapeHtml(desc)}</span>` : "");

    // 移动端：区分点击和滑动，滑动超过 6px 不触发
    // 用 handledByTouch 标记防止 touchend + click 双重触发
    let touchStartX = 0, touchStartY = 0;
    let handledByTouch = false;
    btn.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      handledByTouch = false;
    }, { passive: true });
    btn.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) return; // 是滑动，忽略
      e.preventDefault();
      handledByTouch = true;
      handler();
    });

    btn.addEventListener("click", (e) => {
      if (handledByTouch) { handledByTouch = false; return; }
      handler();
    });
    return btn;
  }

  function makeDivider() {
    const d = document.createElement("span");
    d.className = "shortcut-divider";
    return d;
  }

  // 构建固定按钮行
  function buildFixedRow() {
    shortcutFixedRow.innerHTML = "";

    // 方向键 + ESC（所有 session 共用）
    const arrowKeys = [
      { label: "↑", seq: "\x1b[A" },
      { label: "↓", seq: "\x1b[B" },
      { label: "←", seq: "\x1b[D" },
      { label: "→", seq: "\x1b[C" },
    ];
    arrowKeys.forEach(({ label, seq }) => {
      shortcutFixedRow.appendChild(makeBtn(label, null, () => sendRaw(seq)));
    });
    shortcutFixedRow.appendChild(makeBtn("ESC", null, () => sendRaw("\x1b")));

    // 清空输入框（Ctrl+U）—— 紧跟 ESC
    shortcutFixedRow.appendChild(makeBtn("清空", "清空当前输入行（需确认）", () => {
      showConfirmPopup("清空当前输入行？", () => sendRaw("\x15"));
    }, "util-btn"));

    // 置顶/置底（所有 session 共用，非 tmux 时操作本地 scrollback）
    if (!isTmuxSession()) {
      shortcutFixedRow.appendChild(makeBtn("⤒", "滚动到顶部", () => {
        if (terminal) terminal.scrollToTop();
      }, "util-btn"));
      shortcutFixedRow.appendChild(makeBtn("⤓", "滚动到底部", () => {
        if (terminal) terminal.scrollToBottom();
      }, "util-btn"));
    }

    if (isTmuxSession()) {
      shortcutFixedRow.appendChild(makeDivider());

      // prefix+[ 进入 copy-mode
      shortcutFixedRow.appendChild(makeBtn("滚动", "进入 copy-mode (prefix+[)",
        () => sendTmuxCmd("["), "tmux-btn"));
      // 置顶/置底：通过服务端 API 直接执行 tmux 命令，避免按键时序问题
      shortcutFixedRow.appendChild(makeBtn("⤒", "置顶 (自动进入 copy-mode)",
        () => sendTmuxCopyCmd("history-top"), "tmux-btn"));
      shortcutFixedRow.appendChild(makeBtn("⤓", "置底 (自动进入 copy-mode)",
        () => sendTmuxCopyCmd("history-bottom"), "tmux-btn"));
      // prefix+PageUp 上翻页
      shortcutFixedRow.appendChild(makeBtn("PgUp", "上翻页 (prefix+PageUp)",
        () => sendTmuxCmd("\x1b[5~"), "tmux-btn"));
      // copy-mode 内 q 退出
      shortcutFixedRow.appendChild(makeBtn("q", "退出 copy-mode",
        () => sendRaw("q"), "tmux-btn"));

      shortcutFixedRow.appendChild(makeDivider());

      // prefix+c 新建窗口
      shortcutFixedRow.appendChild(makeBtn("新窗口", "prefix+c 新建 window",
        () => sendTmuxCmd("c"), "tmux-btn"));
      // prefix+, 重命名
      shortcutFixedRow.appendChild(makeBtn("改名", "prefix+, 重命名 window",
        () => sendTmuxCmd(","), "tmux-btn"));
      // prefix+n/p 切换窗口
      shortcutFixedRow.appendChild(makeBtn("→窗口", "prefix+n 下一个 window",
        () => sendTmuxCmd("n"), "tmux-btn"));
      shortcutFixedRow.appendChild(makeBtn("←窗口", "prefix+p 上一个 window",
        () => sendTmuxCmd("p"), "tmux-btn"));
      // prefix+%/" 分割
      shortcutFixedRow.appendChild(makeBtn("竖分", "prefix+% 垂直分割 pane",
        () => sendTmuxCmd("%"), "tmux-btn"));
      shortcutFixedRow.appendChild(makeBtn("横分", 'prefix+" 水平分割 pane',
        () => sendTmuxCmd('"'), "tmux-btn"));
      // prefix+x/z 关闭/最大化
      shortcutFixedRow.appendChild(makeBtn("关面板", "prefix+x 关闭当前 pane",
        () => sendTmuxCmd("x"), "tmux-btn"));
      shortcutFixedRow.appendChild(makeBtn("最大化", "prefix+z 最大化/还原 pane",
        () => sendTmuxCmd("z"), "tmux-btn"));
      // prefix+d detach
      shortcutFixedRow.appendChild(makeBtn("Detach", "prefix+d 分离当前会话",
        () => sendTmuxCmd("d"), "tmux-btn"));

    } else {
      const aiTool = getSessionAiTool();

      if (aiTool === "claude") {
        shortcutFixedRow.appendChild(makeDivider());
        // Ctrl+C 中断当前操作
        shortcutFixedRow.appendChild(makeBtn("Ctrl+C", "中断当前操作",
          () => sendRaw("\x03"), "claude-btn"));
        // Ctrl+D 退出 / EOF
        shortcutFixedRow.appendChild(makeBtn("Ctrl+D", "退出 / EOF",
          () => sendRaw("\x04"), "claude-btn"));
        // 接受（y + Enter）
        shortcutFixedRow.appendChild(makeBtn("接受 y", "输入 y 确认操作",
          () => sendRaw("y\r"), "claude-btn"));
        // 拒绝（n + Enter）
        shortcutFixedRow.appendChild(makeBtn("拒绝 n", "输入 n 拒绝操作",
          () => sendRaw("n\r"), "claude-btn"));

        shortcutFixedRow.appendChild(makeDivider());
        // /clear 清除对话历史
        shortcutFixedRow.appendChild(makeBtn("/clear", "清除对话历史",
          () => sendRaw("/clear\r"), "claude-btn"));
        // /compact 压缩上下文
        shortcutFixedRow.appendChild(makeBtn("/compact", "压缩上下文",
          () => sendRaw("/compact\r"), "claude-btn"));
        // /cost 查看 token 用量
        shortcutFixedRow.appendChild(makeBtn("/cost", "查看 token 用量",
          () => sendRaw("/cost\r"), "claude-btn"));
        // /doctor 诊断环境
        shortcutFixedRow.appendChild(makeBtn("/doctor", "诊断环境",
          () => sendRaw("/doctor\r"), "claude-btn"));

      } else if (aiTool === "codex") {
        shortcutFixedRow.appendChild(makeDivider());
        // Ctrl+C 中断
        shortcutFixedRow.appendChild(makeBtn("Ctrl+C", "中断当前操作",
          () => sendRaw("\x03"), "codex-btn"));
        // Ctrl+D 退出
        shortcutFixedRow.appendChild(makeBtn("Ctrl+D", "退出 Codex",
          () => sendRaw("\x04"), "codex-btn"));
        // 接受 a（approve all changes）
        shortcutFixedRow.appendChild(makeBtn("接受 a", "输入 a 接受所有变更",
          () => sendRaw("a\r"), "codex-btn"));
        // 拒绝 r（reject）
        shortcutFixedRow.appendChild(makeBtn("拒绝 r", "输入 r 拒绝变更",
          () => sendRaw("r\r"), "codex-btn"));
        // 查看 diff d
        shortcutFixedRow.appendChild(makeBtn("Diff d", "输入 d 查看 diff",
          () => sendRaw("d\r"), "codex-btn"));

        shortcutFixedRow.appendChild(makeDivider());
        // Tab 补全
        shortcutFixedRow.appendChild(makeBtn("Tab", "补全",
          () => sendRaw("\x09"), "codex-btn"));
        // Ctrl+R 搜索历史
        shortcutFixedRow.appendChild(makeBtn("Ctrl+R", "搜索历史命令",
          () => sendRaw("\x12"), "codex-btn"));
      }
    }

  }

  // --- 确认弹窗（防误触）---
  function showConfirmPopup(message, onConfirm) {
    const existing = document.getElementById("confirm-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = "confirm-popup";
    popup.innerHTML = `
      <div class="confirm-popup-inner">
        <div class="confirm-popup-msg">${escapeHtml(message)}</div>
        <div class="confirm-popup-btns">
          <button class="confirm-cancel">取消</button>
          <button class="confirm-ok">确认</button>
        </div>
      </div>
    `;

    popup.querySelector(".confirm-cancel").addEventListener("click", () => popup.remove());
    popup.querySelector(".confirm-ok").addEventListener("click", () => {
      popup.remove();
      onConfirm();
    });
    // 点击遮罩关闭
    popup.addEventListener("click", (e) => { if (e.target === popup) popup.remove(); });

    document.body.appendChild(popup);
  }

  // --- 配色选择器 ---
  function showThemePicker() {
    const existing = document.getElementById("theme-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.id = "theme-picker";

    COLOR_THEMES.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "theme-swatch" + (t.id === currentThemeId ? " active" : "");
      btn.title = t.name;
      btn.style.setProperty("--swatch-bg", t.bg);
      btn.innerHTML = `<span class="swatch-dot"></span><span class="swatch-name">${escapeHtml(t.name)}</span>`;
      btn.addEventListener("click", () => {
        applyTheme(t.id);
        picker.querySelectorAll(".theme-swatch").forEach((el) => el.classList.remove("active"));
        btn.classList.add("active");
      });
      picker.appendChild(btn);
    });

    // 关闭按钮
    const closeRow = document.createElement("div");
    closeRow.style.cssText = "text-align:right;padding:4px 6px 2px";
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = SVG.close;
    closeBtn.style.cssText = "background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:14px;padding:2px 6px";
    closeBtn.addEventListener("click", () => picker.remove());
    closeRow.appendChild(closeBtn);
    picker.insertBefore(closeRow, picker.firstChild);

    // 挂到 shortcut-fixed-row 下方
    const bar = document.getElementById("shortcut-bar");
    bar.appendChild(picker);

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener("click", function handler(e) {
        if (!picker.contains(e.target)) {
          picker.remove();
          document.removeEventListener("click", handler);
        }
      });
    }, 50);
  }

  // AI 分析（只在用户点刷新时触发，不自动执行）
  let _fetchSeq = 0;

  async function fetchShortcutSuggestions() {
    const seq = ++_fetchSeq;
    const termText = getTerminalVisibleLines(30);

    shortcutAiKeys.innerHTML = "";

    if (!termText.trim()) {
      shortcutAiKeys.innerHTML = '<span class="shortcut-loading">终端内容为空，请先执行命令</span>';
      return;
    }

    const loadingSpan = document.createElement("span");
    loadingSpan.className = "shortcut-loading";
    loadingSpan.textContent = "AI 分析中…";
    shortcutAiKeys.appendChild(loadingSpan);
    shortcutRefreshBtn.classList.add("loading");

    try {
      const resp = await fetch("/api/ai-shortcuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalText: termText }),
      });

      const data = await resp.json();
      if (seq !== _fetchSeq) return;
      loadingSpan.remove();

      if (!resp.ok) {
        const s = document.createElement("span");
        s.className = "shortcut-error";
        s.textContent = data.error || `错误 ${resp.status}`;
        shortcutAiKeys.appendChild(s);
        return;
      }

      const items = data.items || [];
      items.forEach(({ label, desc, sequence }) => {
        shortcutAiKeys.appendChild(makeBtn(label, desc,
          () => {
            const seq = resolveSequence(label, sequence);
            if (seq) sendRaw(seq);
          }
        ));
      });
    } catch (e) {
      if (seq !== _fetchSeq) return;
      loadingSpan.remove();
      const s = document.createElement("span");
      s.className = "shortcut-error";
      s.textContent = `请求失败: ${e.message}`;
      shortcutAiKeys.appendChild(s);
    } finally {
      if (seq === _fetchSeq) shortcutRefreshBtn.classList.remove("loading");
    }
  }

  function openShortcutBar() {
    shortcutBar.style.display = "flex";
    shortcutToggleBtn.classList.add("active");
    shortcutBarOpen = true;
    buildFixedRow();                          // 固定行每次打开时重建（session 可能已切换）

    // AI 行：仅在服务端配置了 OPENROUTER_API_KEY 时显示
    const aiRow = document.getElementById("shortcut-ai-row");
    if (aiEnabled) {
      aiRow.style.display = "flex";
      if (shortcutAiKeys.children.length === 0) {
        shortcutAiKeys.innerHTML = '<span class="shortcut-loading">点击 ⟳ 让 AI 分析当前终端内容</span>';
      }
    } else {
      aiRow.style.display = "none";
    }

    if (fitAddon && terminal) fitAddon.fit();
  }

  function closeShortcutBar() {
    shortcutBar.style.display = "none";
    shortcutToggleBtn.classList.remove("active");
    shortcutBarOpen = false;
    if (fitAddon && terminal) fitAddon.fit();
  }

  function toggleShortcutBar() {
    shortcutBarOpen ? closeShortcutBar() : openShortcutBar();
  }

  shortcutToggleBtn.addEventListener("click", toggleShortcutBar);
  shortcutRefreshBtn.addEventListener("click", fetchShortcutSuggestions);

  // --- Theme toggle in toolbar ---
  document.getElementById("theme-toggle-btn").addEventListener("click", () => {
    showThemePicker();
  });

  // --- Notification System ---
  const MAX_NOTIFICATIONS = 50;
  const notifications = [];
  let notifIdCounter = 0;
  let notifPanelOpen = false;

  const notifBellBtn = document.getElementById("notif-bell-btn");
  const notifBadge = document.getElementById("notif-badge");
  const notifPanel = document.getElementById("notif-panel");
  const notifList = document.getElementById("notif-list");
  const notifSoundToggle = document.getElementById("notif-sound-toggle");
  const notifMarkAllRead = document.getElementById("notif-mark-all-read");
  const notifClearAll = document.getElementById("notif-clear-all");

  // Sound preference
  let notifSoundEnabled = localStorage.getItem("notifSound") !== "off";
  updateSoundToggleBtn();

  function updateSoundToggleBtn() {
    if (notifSoundEnabled) {
      notifSoundToggle.innerHTML = SVG.soundOn;
      notifSoundToggle.classList.remove("muted");
      notifSoundToggle.title = "Sound on (click to mute)";
    } else {
      notifSoundToggle.innerHTML = SVG.soundOff;
      notifSoundToggle.classList.add("muted");
      notifSoundToggle.title = "Sound off (click to unmute)";
    }
  }

  notifSoundToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    notifSoundEnabled = !notifSoundEnabled;
    localStorage.setItem("notifSound", notifSoundEnabled ? "on" : "off");
    updateSoundToggleBtn();
  });

  // Play notification sound
  function playNotifSound() {
    if (!notifSoundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  // State management — dedup by server timestamp + sessionId
  const recentNotifKeys = new Set();

  function addNotification(data) {
    // Dedup: same sessionId + time means duplicate from lobby+session WS
    const dedupKey = `${data.sessionId}-${data.time}`;
    if (recentNotifKeys.has(dedupKey)) return;
    recentNotifKeys.add(dedupKey);
    // Clean old keys after 10s
    setTimeout(() => recentNotifKeys.delete(dedupKey), 10000);

    const notif = {
      id: ++notifIdCounter,
      sessionId: data.sessionId,
      sessionName: data.sessionName,
      aiTool: data.aiTool,
      message: data.message,
      time: data.time || Date.now(),
      read: false,
    };
    notifications.unshift(notif);
    while (notifications.length > MAX_NOTIFICATIONS) notifications.pop();
    updateBellBadge();
    renderNotifList();
    renderSessionList();
    playNotifSound();
    fireBrowserNotification(notif);
  }

  function markAsRead(id) {
    const n = notifications.find((n) => n.id === id);
    if (n) n.read = true;
    updateBellBadge();
    renderNotifList();
    renderSessionList();
  }

  function markAllAsRead() {
    notifications.forEach((n) => (n.read = true));
    updateBellBadge();
    renderNotifList();
    renderSessionList();
  }

  function clearAllNotifications() {
    notifications.length = 0;
    updateBellBadge();
    renderNotifList();
    renderSessionList();
  }

  function getUnreadCount() {
    return notifications.filter((n) => !n.read).length;
  }

  function getSessionUnreadCount(sessionId) {
    return notifications.filter((n) => n.sessionId === sessionId && !n.read).length;
  }

  function hasSessionUnread(sessionId) {
    return notifications.some((n) => n.sessionId === sessionId && !n.read);
  }

  function markSessionAsRead(sessionId) {
    notifications.forEach((n) => {
      if (n.sessionId === sessionId) n.read = true;
    });
    updateBellBadge();
    renderSessionList();
  }

  function updateBellBadge() {
    const count = getUnreadCount();
    if (count > 0) {
      notifBadge.textContent = count > 99 ? "99+" : count;
      notifBadge.style.display = "block";
      notifBellBtn.classList.add("bell-shaking");
    } else {
      notifBadge.style.display = "none";
      notifBellBtn.classList.remove("bell-shaking");
    }
  }

  // Relative time formatting
  function relativeTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return diff + "s ago";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  }

  function renderNotifList() {
    notifList.innerHTML = "";
    if (notifications.length === 0) {
      notifList.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    notifications.forEach((n) => {
      const item = document.createElement("div");
      item.className = "notif-item" + (n.read ? "" : " unread");
      const notifIcon = n.aiTool === "claude" ? SVG.claude : n.aiTool === "codex" ? SVG.codex : SVG.bell;
      item.innerHTML = `
        <span class="notif-item-icon">${notifIcon}</span>
        <div class="notif-item-body">
          <div class="notif-item-session">${escapeHtml(n.sessionName)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        </div>
        <span class="notif-item-time">${relativeTime(n.time)}</span>
      `;
      item.addEventListener("click", () => handleNotifClick(n));
      notifList.appendChild(item);
    });
  }

  function handleNotifClick(notif) {
    markAsRead(notif.id);
    closeNotifPanel();

    // Check if session still exists
    const sessionExists = sessions.some((s) => s.id === notif.sessionId);
    if (!sessionExists) {
      showCopyToast();
      copyToast.textContent = "Session no longer exists";
      setTimeout(() => { copyToast.textContent = "Copied!"; }, 1500);
      return;
    }

    if (notif.sessionId !== activeSessionId) {
      switchSession(notif.sessionId);
      toggleSidebar(true);
    } else {
      if (terminal) terminal.focus();
    }
  }

  // Panel toggle
  function openNotifPanel() {
    notifPanel.style.display = "flex";
    notifPanelOpen = true;
    renderNotifList();
    // Request notification permission on first interaction
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function closeNotifPanel() {
    notifPanel.style.display = "none";
    notifPanelOpen = false;
  }

  function toggleNotifPanel() {
    notifPanelOpen ? closeNotifPanel() : openNotifPanel();
  }

  notifBellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNotifPanel();
  });

  notifPanel.addEventListener("click", (e) => e.stopPropagation());

  notifMarkAllRead.addEventListener("click", markAllAsRead);
  notifClearAll.addEventListener("click", clearAllNotifications);

  // Close panel when clicking outside
  document.addEventListener("click", () => {
    if (notifPanelOpen) closeNotifPanel();
  });

  // Browser Notification API
  function fireBrowserNotification(notif) {
    if (!document.hidden) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const title = `${notif.aiTool === "claude" ? "Claude" : notif.aiTool === "codex" ? "Codex" : "Terminal"} - ${notif.sessionName}`;
      const n = new Notification(title, { body: notif.message, tag: "web-terminal-" + notif.sessionId });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {}
  }

  // Update relative times periodically
  setInterval(() => {
    if (notifPanelOpen) renderNotifList();
  }, 30000);

  // --- Sidebar Tab Switching (US-008) ---
  let activeSidebarTab = "sessions";
  const sidebarTabs = document.querySelectorAll(".sidebar-tab");
  const panelSessions = document.getElementById("sidebar-panel-sessions");
  const panelFiles = document.getElementById("sidebar-panel-files");

  function switchSidebarTab(tab) {
    activeSidebarTab = tab;
    sidebarTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    panelSessions.style.display = tab === "sessions" ? "flex" : "none";
    panelFiles.style.display = tab === "files" ? "flex" : "none";
    if (tab === "files" && activeSessionId) loadFileTreeForSession();
  }

  sidebarTabs.forEach((t) => t.addEventListener("click", () => switchSidebarTab(t.dataset.tab)));

  // --- File Tree (US-009) ---
  const fileTree = document.getElementById("file-tree");
  const fileTreePath = document.getElementById("file-tree-path");
  const fileTreeBackBtn = document.getElementById("file-tree-back-btn");
  const fileHiddenToggle = document.getElementById("file-tree-hidden-toggle");
  const fileUploadBtn = document.getElementById("file-tree-upload-btn");
  const fileRefreshBtn = document.getElementById("file-tree-refresh-btn");
  const fileUploadInput = document.getElementById("file-upload-input");

  let fileTreeRoot = null; // current root path
  const sessionFileTreeRoots = new Map(); // session ID -> file tree root path
  const sessionCwds = new Map(); // session ID -> session cwd (baseline)
  let showHiddenFiles = localStorage.getItem("showHidden") === "true";
  if (showHiddenFiles) fileHiddenToggle.classList.add("active");

  fileHiddenToggle.addEventListener("click", () => {
    showHiddenFiles = !showHiddenFiles;
    localStorage.setItem("showHidden", showHiddenFiles);
    fileHiddenToggle.classList.toggle("active", showHiddenFiles);
    if (fileTreeRoot) renderFileTreeRoot(fileTreeRoot);
  });

  fileRefreshBtn.addEventListener("click", () => {
    if (fileTreeRoot) renderFileTreeRoot(fileTreeRoot);
  });

  async function loadFileTreeForSession() {
    if (!activeSessionId) return;
    try {
      const r = await fetch(`/api/sessions/${activeSessionId}/cwd`);
      const d = await r.json();
      sessionCwds.set(activeSessionId, d.cwd);
      // Restore stored root or default to session cwd
      const storedRoot = sessionFileTreeRoots.get(activeSessionId);
      fileTreeRoot = storedRoot || d.cwd;
      fileTreePath.textContent = fileTreeRoot;
      fileTreePath.title = fileTreeRoot;
      updateFileTreeBackBtn();
      renderFileTreeRoot(fileTreeRoot);
    } catch {
      fileTree.innerHTML = '<div class="ft-empty">Failed to load</div>';
    }
  }

  function navigateFileTree(newRoot) {
    if (!activeSessionId) return;
    fileTreeRoot = newRoot;
    sessionFileTreeRoots.set(activeSessionId, newRoot);
    fileTreePath.textContent = newRoot;
    fileTreePath.title = newRoot;
    updateFileTreeBackBtn();
    renderFileTreeRoot(newRoot);
  }

  function updateFileTreeBackBtn() {
    fileTreeBackBtn.disabled = !fileTreeRoot || fileTreeRoot === "/";
  }

  fileTreeBackBtn.addEventListener("click", () => {
    if (fileTreeBackBtn.disabled || !fileTreeRoot) return;
    const parent = fileTreeRoot.replace(/\/[^/]+\/?$/, "") || "/";
    navigateFileTree(parent);
  });

  async function renderFileTreeRoot(rootPath) {
    fileTree.innerHTML = '<div class="ft-loading">Loading...</div>';
    try {
      const r = await fetch(`/api/fs/list?path=${encodeURIComponent(rootPath)}&hidden=${showHiddenFiles}`);
      const d = await r.json();
      fileTree.innerHTML = "";
      if (d.entries.length === 0) {
        fileTree.innerHTML = '<div class="ft-empty">(empty)</div>';
        return;
      }
      d.entries.forEach((entry) => {
        fileTree.appendChild(createFileTreeItem(entry, rootPath, 0));
      });
    } catch {
      fileTree.innerHTML = '<div class="ft-empty">Failed to load</div>';
    }
  }

  function createFileTreeItem(entry, parentPath, depth) {
    const fullPath = parentPath.replace(/\/$/, "") + "/" + entry.name;
    const item = document.createElement("div");

    const row = document.createElement("div");
    row.className = "ft-item";
    row.style.paddingLeft = (8 + depth * 16) + "px";
    row.dataset.path = fullPath;
    row.dataset.type = entry.type;

    const icon = document.createElement("span");
    icon.className = "ft-icon";
    icon.innerHTML = entry.type === "directory" ? SVG.folder : SVG.file;
    icon.classList.add(entry.type === "directory" ? "folder-icon" : "file-icon");

    const name = document.createElement("span");
    name.className = "ft-name";
    name.textContent = entry.name;

    row.appendChild(icon);
    row.appendChild(name);

    if (entry.type === "file" && entry.size != null) {
      const size = document.createElement("span");
      size.className = "ft-size";
      size.textContent = formatFileSize(entry.size);
      row.appendChild(size);
    }

    item.appendChild(row);

    if (entry.type === "directory") {
      const children = document.createElement("div");
      children.className = "ft-children";
      item.appendChild(children);

      // Double-click to drill into folder as new root
      row.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateFileTree(fullPath);
      });

      let loaded = false;
      row.addEventListener("click", async () => {
        if (!loaded) {
          children.innerHTML = '<div class="ft-loading">Loading...</div>';
          children.classList.add("open");
          try {
            const r = await fetch(`/api/fs/list?path=${encodeURIComponent(fullPath)}&hidden=${showHiddenFiles}`);
            const d = await r.json();
            children.innerHTML = "";
            if (d.entries.length === 0) {
              children.innerHTML = '<div class="ft-empty">(empty)</div>';
            } else {
              d.entries.forEach((e) => children.appendChild(createFileTreeItem(e, fullPath, depth + 1)));
            }
            loaded = true;
          } catch {
            children.innerHTML = '<div class="ft-empty">Failed to load</div>';
          }
          icon.innerHTML = SVG.folderOpen; // open folder
        } else {
          const isOpen = children.classList.toggle("open");
          icon.innerHTML = isOpen ? SVG.folderOpen : SVG.folder;
        }
      });
    } else {
      // File click -> open in editor
      row.addEventListener("click", () => openFileInEditor(fullPath, entry.name));
    }

    // Context menu
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, fullPath, entry, parentPath, item);
    });

    // Long press for mobile
    let longPressTimer = null;
    row.addEventListener("touchstart", (e) => {
      longPressTimer = setTimeout(() => {
        e.preventDefault();
        const touch = e.touches[0];
        showContextMenu(touch.clientX, touch.clientY, fullPath, entry, parentPath, item);
      }, 500);
    }, { passive: false });
    row.addEventListener("touchend", () => clearTimeout(longPressTimer));
    row.addEventListener("touchmove", () => clearTimeout(longPressTimer));

    return item;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // --- Context Menu (US-010) ---
  function showContextMenu(x, y, filePath, entry, parentPath, itemEl) {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "ft-context-menu";
    menu.id = "ft-ctx";

    const items = [];
    if (entry.type === "directory") {
      items.push({ label: "New File", action: () => inlineCreate(itemEl, filePath, "file") });
      items.push({ label: "New Folder", action: () => inlineCreate(itemEl, filePath, "directory") });
      items.push(null); // separator
    }
    items.push({ label: "Rename", action: () => inlineRename(filePath, entry, parentPath) });
    items.push({ label: "Delete", action: () => deleteEntry(filePath, entry.name) });
    items.push(null);
    items.push({ label: "Download", action: () => downloadEntry(filePath) });

    items.forEach((it) => {
      if (!it) { const sep = document.createElement("div"); sep.className = "ft-context-sep"; menu.appendChild(sep); return; }
      const el = document.createElement("div");
      el.className = "ft-context-item";
      el.textContent = it.label;
      el.addEventListener("click", () => { closeContextMenu(); it.action(); });
      menu.appendChild(el);
    });

    // Position
    menu.style.left = Math.min(x, window.innerWidth - 170) + "px";
    menu.style.top = Math.min(y, window.innerHeight - 200) + "px";
    document.body.appendChild(menu);

    setTimeout(() => document.addEventListener("click", closeContextMenu, { once: true }), 10);
  }

  function closeContextMenu() {
    const m = document.getElementById("ft-ctx");
    if (m) m.remove();
  }

  async function inlineCreate(itemEl, parentPath, type) {
    const name = prompt(type === "file" ? "New file name:" : "New folder name:");
    if (!name || !name.trim()) return;
    const newPath = parentPath.replace(/\/$/, "") + "/" + name.trim();
    try {
      const r = await fetch("/api/fs/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath, type }),
      });
      if (!r.ok) { const e = await r.json(); alert(e.error); return; }
      if (fileTreeRoot) renderFileTreeRoot(fileTreeRoot);
    } catch {}
  }

  async function inlineRename(filePath, entry, parentPath) {
    const newName = prompt("Rename to:", entry.name);
    if (!newName || !newName.trim() || newName.trim() === entry.name) return;
    const newPath = parentPath.replace(/\/$/, "") + "/" + newName.trim();
    try {
      const r = await fetch("/api/fs/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: filePath, newPath }),
      });
      if (!r.ok) { const e = await r.json(); alert(e.error); return; }
      if (fileTreeRoot) renderFileTreeRoot(fileTreeRoot);
    } catch {}
  }

  async function deleteEntry(filePath, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const r = await fetch("/api/fs/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      if (!r.ok) { const e = await r.json(); alert(e.error); return; }
      if (fileTreeRoot) renderFileTreeRoot(fileTreeRoot);
    } catch {}
  }

  function downloadEntry(filePath) {
    const a = document.createElement("a");
    a.href = "/api/fs/download?path=" + encodeURIComponent(filePath);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // --- File Upload (US-013) ---
  fileUploadBtn.addEventListener("click", () => fileUploadInput.click());

  fileUploadInput.addEventListener("change", async () => {
    if (!fileUploadInput.files.length || !fileTreeRoot) return;
    const formData = new FormData();
    for (const f of fileUploadInput.files) formData.append("files", f);
    try {
      await fetch(`/api/fs/upload?dest=${encodeURIComponent(fileTreeRoot)}`, { method: "POST", body: formData });
      renderFileTreeRoot(fileTreeRoot);
    } catch {}
    fileUploadInput.value = "";
  });

  // Drag and drop on file tree
  fileTree.addEventListener("dragover", (e) => { e.preventDefault(); fileTree.classList.add("drag-over"); });
  fileTree.addEventListener("dragleave", () => fileTree.classList.remove("drag-over"));
  fileTree.addEventListener("drop", async (e) => {
    e.preventDefault();
    fileTree.classList.remove("drag-over");
    if (!e.dataTransfer.files.length || !fileTreeRoot) return;
    const formData = new FormData();
    for (const f of e.dataTransfer.files) formData.append("files", f);
    try {
      await fetch(`/api/fs/upload?dest=${encodeURIComponent(fileTreeRoot)}`, { method: "POST", body: formData });
      renderFileTreeRoot(fileTreeRoot);
    } catch {}
  });

  // --- Code Editor (US-011, US-012) ---
  const editorContainer = document.getElementById("editor-container");
  const editorArea = document.getElementById("editor-area");
  const editorFilename = document.getElementById("editor-filename");
  const editorLang = document.getElementById("editor-lang");
  const editorPosition = document.getElementById("editor-position");
  const editorSaveStatus = document.getElementById("editor-save-status");
  const editorEditBtn = document.getElementById("editor-edit-btn");
  const editorCloseBtn = document.getElementById("editor-close-btn");

  let editorView = null;
  let editorFilePath = null;
  let editorSaveTimer = null;
  let editorDirty = false;
  let editorReadOnly = true;
  let editorReadOnlyCompartment = null;

  async function openFileInEditor(filePath, fileName) {
    try {
      const r = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
      const d = await r.json();

      if (d.tooLarge) {
        alert(`File too large (${formatFileSize(d.size)}). Max 1MB for editing.`);
        downloadEntry(filePath);
        return;
      }
      if (d.binary) {
        alert("Binary file — download only.");
        downloadEntry(filePath);
        return;
      }

      // Wait for editor module
      const mod = window._editorModule;
      if (!mod || !mod.loaded) {
        alert("Editor is still loading. Please try again.");
        return;
      }

      // Destroy previous editor
      if (editorView) { editorView.destroy(); editorView = null; }
      clearTimeout(editorSaveTimer);

      editorFilePath = filePath;
      editorDirty = false;
      editorReadOnly = true;
      editorReadOnlyCompartment = new mod.Compartment();
      editorFilename.textContent = fileName;
      editorFilename.title = filePath;
      editorLang.textContent = mod.getLangName(fileName);
      editorPosition.textContent = "1:1";
      updateSaveStatus("readonly");
      updateEditorEditBtn();

      // Show editor, hide terminal
      terminalContainer.style.display = "none";
      editorContainer.style.display = "flex";

      const langExt = mod.getLangExtension(fileName);
      const updateListener = mod.EditorView.updateListener.of((update) => {
        if (update.docChanged && !editorReadOnly) {
          editorDirty = true;
          updateSaveStatus("unsaved");
          clearTimeout(editorSaveTimer);
          editorSaveTimer = setTimeout(() => autoSave(), 1000);
        }
        if (update.selectionSet) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          editorPosition.textContent = line.number + ":" + (pos - line.from + 1);
        }
      });

      editorView = new mod.EditorView({
        state: mod.EditorState.create({
          doc: d.content,
          extensions: [mod.basicSetup, mod.oneDark, ...langExt, updateListener, editorReadOnlyCompartment.of(mod.EditorState.readOnly.of(true))],
        }),
        parent: editorArea,
      });

      editorView.focus();
    } catch (e) {
      alert("Failed to open file: " + e.message);
    }
  }

  function updateSaveStatus(status, msg) {
    editorSaveStatus.className = status;
    if (status === "saved") editorSaveStatus.innerHTML = `<span style="color:var(--success)">●</span> Saved`;
    else if (status === "saving") editorSaveStatus.innerHTML = `<span style="color:var(--text-dim)">●</span> Saving...`;
    else if (status === "unsaved") editorSaveStatus.innerHTML = `<span style="color:var(--warning)">●</span> Unsaved`;
    else if (status === "error") editorSaveStatus.innerHTML = `<span style="color:var(--danger)">●</span> ${msg || "Error"}`;
    else if (status === "readonly") editorSaveStatus.innerHTML = `${SVG.lock} 只读`;
  }

  function updateEditorEditBtn() {
    if (editorReadOnly) {
      editorEditBtn.innerHTML = `${SVG.unlock} 编辑`;
      editorEditBtn.classList.remove("editing");
      editorEditBtn.title = "点击开启编辑";
    } else {
      editorEditBtn.innerHTML = `${SVG.lock} 只读`;
      editorEditBtn.classList.add("editing");
      editorEditBtn.title = "点击切换为只读";
    }
  }

  function toggleEditorReadOnly() {
    if (!editorView || !editorReadOnlyCompartment) return;
    const mod = window._editorModule;
    if (!mod) return;

    if (editorReadOnly) {
      // Switch to edit mode
      editorReadOnly = false;
      editorView.dispatch({ effects: editorReadOnlyCompartment.reconfigure(mod.EditorState.readOnly.of(false)) });
      updateSaveStatus(editorDirty ? "unsaved" : "saved");
    } else {
      // Switch to read-only
      if (editorDirty) {
        if (!confirm("Save changes before switching to read-only?")) {
          // Stay in edit mode
          return;
        }
        autoSave();
      }
      editorReadOnly = true;
      editorView.dispatch({ effects: editorReadOnlyCompartment.reconfigure(mod.EditorState.readOnly.of(true)) });
      updateSaveStatus("readonly");
    }
    updateEditorEditBtn();
  }

  async function autoSave() {
    if (!editorView || !editorFilePath || !editorDirty) return;
    updateSaveStatus("saving");
    try {
      const content = editorView.state.doc.toString();
      const r = await fetch("/api/fs/write", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editorFilePath, content }),
      });
      if (r.ok) {
        editorDirty = false;
        updateSaveStatus("saved");
      } else {
        const e = await r.json();
        updateSaveStatus("error", e.error);
      }
    } catch (e) {
      updateSaveStatus("error", e.message);
    }
  }

  function closeEditor() {
    if (editorDirty) {
      if (!confirm("Unsaved changes will be lost. Close anyway?")) return;
    }
    clearTimeout(editorSaveTimer);
    if (editorView) { editorView.destroy(); editorView = null; }
    editorArea.innerHTML = "";
    editorFilePath = null;
    editorDirty = false;
    editorContainer.style.display = "none";
    terminalContainer.style.display = "block";
    if (terminal) terminal.focus();
  }

  editorCloseBtn.addEventListener("click", closeEditor);
  editorEditBtn.addEventListener("click", toggleEditorReadOnly);

  // Ctrl+S / Cmd+S to save (only in edit mode)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && editorContainer.style.display !== "none") {
      e.preventDefault();
      if (!editorReadOnly) {
        clearTimeout(editorSaveTimer);
        autoSave();
      }
    }
  });

  // Refresh file tree when switching sessions
  const origSwitchSession = switchSession;
  // (switchSession already defined, we patch it to also refresh file tree)

  // --- Init ---
  // 应用保存的配色（更新 --bg CSS 变量）
  applyTheme(currentThemeId);
  connectLobby();
  updateMainView();

  // 获取服务端配置（AI 功能是否启用）
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      aiEnabled = !!cfg.aiEnabled;
      // 若 AI 未启用，隐藏工具栏上的 AI 快捷键按钮
      if (!aiEnabled) {
        shortcutToggleBtn.style.display = "none";
      }
    })
    .catch(() => { aiEnabled = false; });

  fetch("/api/sessions")
    .then((r) => r.json())
    .then((list) => {
      sessions = list;
      renderSessionList();
      initialLoadDone = true; // 之后 lobby 推送才允许更新列表
      if (list.length > 0) {
        switchSession(list[0].id);
      }
    });
})();
