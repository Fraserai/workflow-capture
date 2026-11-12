import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { RecorderConfigSchema, type RecorderConfig } from "@workflow-capture-ai/schema";

type WorkerCommand =
  | { type: "getStatus" }
  | { type: "setConfig"; payload: RecorderConfig }
  | {
      type: "start";
      payload: {
        config: RecorderConfig;
        environment: {
          employeeIdentifier: string;
          machineName: string;
          os: string;
        };
      };
    }
  | { type: "pause" }
  | { type: "stop" };

type RecorderStatus = {
  recording: boolean;
  paused: boolean;
  sessionRef: string | null;
  remoteSessionId: string | null;
  pendingCount: number;
  eventCount: number;
  screenshotCount: number;
  apiConnected: boolean;
  lastError: string | null;
  currentApp: string | null;
  currentWindow: string | null;
  recentActivity: string[];
  lastSyncAt: string | null;
};

type TrayVisualState = "idle" | "recording" | "syncing" | "error";

const defaultConfig: RecorderConfig = {
  apiBaseUrl: "http://127.0.0.1:8000",
  organizationName: "Your organization",
  captureScreenshots: true,
  screenshotIntervalSeconds: 5,
  excludedApps: [],
  excludedDomains: [],
  debugMode: false,
  hasCompletedOnboarding: false,
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let workerProcess: ChildProcessWithoutNullStreams | null = null;
let workerStdoutBuffer = "";
let currentStatus: RecorderStatus = {
  recording: false,
  paused: false,
  sessionRef: null,
  remoteSessionId: null,
  pendingCount: 0,
  eventCount: 0,
  screenshotCount: 0,
  apiConnected: true,
  lastError: null,
  currentApp: null,
  currentWindow: null,
  recentActivity: ["Recorder ready"],
  lastSyncAt: null,
};

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "recorder-config.json");
}

function getWorkerStateDir(): string {
  return path.join(app.getPath("userData"), "capture-state");
}

function buildEnvironment(employeeIdentifier?: string): { employeeIdentifier: string; machineName: string; os: string } {
  return {
    employeeIdentifier: employeeIdentifier || os.userInfo().username,
    machineName: os.hostname(),
    os: `${process.platform} ${os.release()}`,
  };
}

async function readConfig(): Promise<RecorderConfig> {
  try {
    const content = await fs.readFile(getConfigPath(), "utf-8");
    return RecorderConfigSchema.parse({
      ...defaultConfig,
      ...JSON.parse(content),
    });
  } catch {
    return defaultConfig;
  }
}

async function writeConfig(config: RecorderConfig): Promise<RecorderConfig> {
  const parsed = RecorderConfigSchema.parse({
    ...defaultConfig,
    ...config,
  });
  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(parsed, null, 2), "utf-8");
  return parsed;
}

function createTrayIcon(state: TrayVisualState): Electron.NativeImage {
  const palette = {
    idle: { outer: "#475569", inner: "#e2e8f0" },
    recording: { outer: "#08131f", inner: "#34d399" },
    syncing: { outer: "#0c1525", inner: "#7dd3fc" },
    error: { outer: "#140b10", inner: "#fb7185" },
  }[state];

  const svg = `
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trayGradient" x1="1.5" y1="1.5" x2="16.5" y2="16.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${palette.outer}" />
          <stop offset="1" stop-color="#020617" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="15" height="15" rx="4.5" fill="url(#trayGradient)" />
      <circle cx="9" cy="9" r="4.2" fill="${palette.inner}" />
    </svg>
  `;

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function trayState(): TrayVisualState {
  if (currentStatus.lastError && !currentStatus.apiConnected) {
    return "error";
  }
  if (!currentStatus.recording && !currentStatus.paused && currentStatus.pendingCount > 0 && currentStatus.apiConnected) {
    return "syncing";
  }
  if (currentStatus.recording) {
    return "recording";
  }
  return "idle";
}

function trayTooltip(): string {
  const state = trayState();
  if (state === "recording") {
    return "workflow-capture-ai recorder: recording";
  }
  if (state === "syncing") {
    return "workflow-capture-ai recorder: syncing";
  }
  if (state === "error") {
    return "workflow-capture-ai recorder: attention needed";
  }
  return "workflow-capture-ai recorder: idle";
}

function broadcastToWindow(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function updateTray(): void {
  if (!tray) {
    return;
  }

  const state = trayState();
  tray.setImage(createTrayIcon(state));
  tray.setToolTip(trayTooltip());

  const menu = Menu.buildFromTemplate([
    {
      label:
        state === "recording"
          ? "Recorder is active"
          : state === "syncing"
            ? "Recorder is syncing"
            : state === "error"
              ? "Recorder needs attention"
              : "Recorder is idle",
      enabled: false,
    },
    { type: "separator" },
    {
      label: currentStatus.paused ? "Resume recording" : "Start recording",
      enabled: !currentStatus.recording,
      click: () => {
        void startRecordingFromTray();
      },
    },
    {
      label: "Pause recording",
      enabled: currentStatus.recording,
      click: () => {
        sendWorkerCommand({ type: "pause" });
      },
    },
    {
      label: "Stop recording",
      enabled: currentStatus.recording || currentStatus.paused,
      click: () => {
        sendWorkerCommand({ type: "stop" });
      },
    },
    { type: "separator" },
    {
      label: "Open settings",
      click: () => {
        showPopover();
        broadcastToWindow("recorder:open-settings");
      },
    },
    {
      label: "Open diagnostics",
      click: () => {
        showPopover();
        broadcastToWindow("recorder:open-diagnostics");
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function broadcastStatus(): void {
  broadcastToWindow("recorder:status", currentStatus);
  updateTray();
}

function mergeStatus(partial: Partial<RecorderStatus>): void {
  currentStatus = {
    ...currentStatus,
    ...partial,
  };
  broadcastStatus();
}

function ensureWorker(): ChildProcessWithoutNullStreams {
  if (workerProcess) {
    return workerProcess;
  }

  const workerPath = path.join(__dirname, "capture-worker.js");
  workerProcess = spawn(process.env.NODE_BINARY || "node", [workerPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      RECORDER_STATE_DIR: getWorkerStateDir(),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  workerProcess.stdout.on("data", (chunk) => {
    workerStdoutBuffer += chunk.toString();
    const lines = workerStdoutBuffer.split("\n");
    workerStdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const message = JSON.parse(line) as { type: string; payload?: RecorderStatus };
        if (message.type === "status" && message.payload) {
          currentStatus = message.payload;
          broadcastStatus();
        }
      } catch {
        mergeStatus({
          lastError: "Failed to parse worker status update",
        });
      }
    }
  });

  workerProcess.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (!message) {
      return;
    }
    mergeStatus({
      lastError: message,
      recentActivity: [...currentStatus.recentActivity.slice(-7), `Worker: ${message}`],
    });
  });

  workerProcess.on("exit", (code) => {
    workerProcess = null;
    mergeStatus({
      recording: false,
      paused: false,
      lastError: `Capture worker exited with code ${code ?? "unknown"}`,
      recentActivity: [...currentStatus.recentActivity.slice(-7), "Capture worker exited"],
    });
  });

  return workerProcess;
}

function sendWorkerCommand(command: WorkerCommand): void {
  const worker = ensureWorker();
  worker.stdin.write(`${JSON.stringify(command)}\n`);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 344,
    height: 420,
    minWidth: 344,
    minHeight: 420,
    maxWidth: 344,
    maxHeight: 560,
    show: false,
    frame: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    movable: true,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    vibrancy: "under-window",
    titleBarStyle: "hidden",
    title: "workflow-capture-ai recorder",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  void mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("blur", () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });
}

function positionPopover(): void {
  if (!mainWindow || !tray) {
    return;
  }

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const { width: popoverWidth, height: popoverHeight } = mainWindow.getBounds();
  const x = Math.round(
    Math.min(
      Math.max(display.workArea.x + 12, trayBounds.x + Math.round(trayBounds.width / 2) - Math.round(popoverWidth / 2)),
      display.workArea.x + display.workArea.width - popoverWidth - 12
    )
  );
  const y =
    process.platform === "darwin"
      ? Math.round(trayBounds.y + trayBounds.height + 8)
      : Math.round(Math.max(display.workArea.y + 12, trayBounds.y - popoverHeight - 8));
  mainWindow.setPosition(x, y, false);
}

function showPopover(): void {
  if (!mainWindow) {
    return;
  }
  positionPopover();
  mainWindow.show();
  mainWindow.focus();
}

function togglePopover(): void {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  showPopover();
}

function createTray(): void {
  tray = new Tray(createTrayIcon(trayState()));
  tray.on("click", () => {
    togglePopover();
  });
  tray.on("right-click", () => {
    updateTray();
  });
  updateTray();
}

async function startRecordingFromTray(employeeIdentifier?: string): Promise<void> {
  const config = await readConfig();
  sendWorkerCommand({
    type: "start",
    payload: {
      config,
      environment: buildEnvironment(employeeIdentifier),
    },
  });
}

app.whenReady().then(async () => {
  await fs.mkdir(getWorkerStateDir(), { recursive: true });
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
  ensureWorker();
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  if (workerProcess) {
    workerProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  showPopover();
});

ipcMain.handle("recorder:getConfig", async () => readConfig());

ipcMain.handle("recorder:saveConfig", async (_event, config: RecorderConfig) => {
  const saved = await writeConfig(config);
  sendWorkerCommand({ type: "setConfig", payload: saved });
  broadcastToWindow("recorder:config-updated", saved);
  return saved;
});

ipcMain.handle("recorder:getEnvironment", async () => buildEnvironment());

ipcMain.handle("recorder:getStatus", async () => {
  sendWorkerCommand({ type: "getStatus" });
  return currentStatus;
});

ipcMain.handle("recorder:startRecording", async (_event, payload: { employeeIdentifier: string }) => {
  await startRecordingFromTray(payload.employeeIdentifier);
  return true;
});

ipcMain.handle("recorder:pauseRecording", async () => {
  sendWorkerCommand({ type: "pause" });
  return true;
});

ipcMain.handle("recorder:stopRecording", async () => {
  sendWorkerCommand({ type: "stop" });
  return true;
});

ipcMain.handle("recorder:openSettings", async () => {
  showPopover();
  broadcastToWindow("recorder:open-settings");
  return true;
});

ipcMain.handle("recorder:openDiagnostics", async () => {
  showPopover();
  broadcastToWindow("recorder:open-diagnostics");
  return true;
});
