import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { EventInput, RecorderConfig, SessionCreateInput } from "@workflow-capture-ai/schema";
import { RecorderConfigSchema } from "@workflow-capture-ai/schema";

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

type QueueItem =
  | { id: string; type: "create_session"; sessionRef: string; payload: SessionCreateInput }
  | { id: string; type: "events"; sessionRef: string; payload: { events: EventInput[] } }
  | {
      id: string;
      type: "screenshot";
      sessionRef: string;
      payload: { occurredAt: string; filePath: string; redactionStatus: string };
    }
  | { id: string; type: "stop_session"; sessionRef: string; payload: { endedAt: string } };

type CaptureContext = {
  appName: string | null;
  processName: string | null;
  windowTitle: string | null;
  url: string | null;
  domain: string | null;
  excluded: boolean;
};

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

type ActiveWinResult = {
  title?: string;
  url?: string;
  owner?: {
    name?: string;
    processName?: string;
  };
};

const stateDir = process.env.RECORDER_STATE_DIR || path.join(process.cwd(), ".capture-state");
const queuePath = path.join(stateDir, "queue.json");
const sessionMapPath = path.join(stateDir, "session-map.json");
const screenshotBufferDir = path.join(stateDir, "screenshots");

let config: RecorderConfig = RecorderConfigSchema.parse({
  apiBaseUrl: "http://localhost:8000",
  captureScreenshots: true,
  screenshotIntervalSeconds: 5,
  excludedApps: [],
  excludedDomains: [],
});
let queue: QueueItem[] = [];
let sessionMap: Record<string, string> = {};
let pendingEvents: EventInput[] = [];
let currentContext: CaptureContext = {
  appName: null,
  processName: null,
  windowTitle: null,
  url: null,
  domain: null,
  excluded: false,
};
let lastContextSignature = "";
let currentSessionRef: string | null = null;
let currentRemoteSessionId: string | null = null;
let recording = false;
let paused = false;
let eventCount = 0;
let screenshotCount = 0;
let sequenceNumber = 0;
let lastError: string | null = null;
let apiConnected = true;
let recentActivity = ["Recorder worker ready"];
let lastSyncAt: string | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let screenshotTimer: NodeJS.Timeout | null = null;
let contextTimer: NodeJS.Timeout | null = null;
let activeWinLoader: null | (() => Promise<ActiveWinResult | undefined>) = null;
let screenshotModule: null | ((options?: { format?: string }) => Promise<Buffer>) = null;

function trimActivity(items: string[]): string[] {
  return items.slice(-8);
}

function updateStatus(partial: Partial<RecorderStatus> = {}): void {
  const status: RecorderStatus = {
    recording,
    paused,
    sessionRef: currentSessionRef,
    remoteSessionId: currentRemoteSessionId,
    pendingCount: queue.length + pendingEvents.length,
    eventCount,
    screenshotCount,
    apiConnected,
    lastError,
    currentApp: currentContext.appName,
    currentWindow: currentContext.windowTitle,
    recentActivity,
    lastSyncAt,
    ...partial,
  };
  process.stdout.write(`${JSON.stringify({ type: "status", payload: status })}\n`);
}

function addActivity(message: string): void {
  recentActivity = trimActivity([...recentActivity, message]);
  updateStatus();
}

function setError(message: string | null): void {
  lastError = message;
  updateStatus();
}

function markSynced(activity?: string): void {
  apiConnected = true;
  lastError = null;
  lastSyncAt = new Date().toISOString();
  if (activity) {
    recentActivity = trimActivity([...recentActivity, activity]);
  }
  updateStatus();
}

async function ensureStateDirectories(): Promise<void> {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(screenshotBufferDir, { recursive: true });
}

async function loadState(): Promise<void> {
  await ensureStateDirectories();
  try {
    queue = JSON.parse(await fs.readFile(queuePath, "utf-8")) as QueueItem[];
  } catch {
    queue = [];
  }

  try {
    sessionMap = JSON.parse(await fs.readFile(sessionMapPath, "utf-8")) as Record<string, string>;
  } catch {
    sessionMap = {};
  }
  updateStatus();
}

async function persistQueue(): Promise<void> {
  await fs.writeFile(queuePath, JSON.stringify(queue, null, 2), "utf-8");
}

async function persistSessionMap(): Promise<void> {
  await fs.writeFile(sessionMapPath, JSON.stringify(sessionMap, null, 2), "utf-8");
}

async function enqueue(item: QueueItem): Promise<void> {
  queue.push(item);
  await persistQueue();
  updateStatus();
}

function resolveSessionId(sessionRef: string | null): string | null {
  if (!sessionRef) {
    return null;
  }
  if (sessionRef.startsWith("sess_")) {
    return sessionRef;
  }
  const mapped = sessionMap[sessionRef];
  if (mapped) {
    currentRemoteSessionId = mapped;
  }
  return mapped ?? null;
}

function extractDomain(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function matchesExclusions(context: CaptureContext): boolean {
  const lowerApps = config.excludedApps.map((item) => item.toLowerCase());
  const lowerDomains = config.excludedDomains.map((item) => item.toLowerCase());
  const appName = (context.appName || context.processName || "").toLowerCase();
  const domain = (context.domain || "").toLowerCase();

  return lowerApps.some((item) => appName.includes(item)) || lowerDomains.some((item) => domain.includes(item));
}

async function getActiveWinLoader(): Promise<() => Promise<ActiveWinResult | undefined>> {
  if (!activeWinLoader) {
    const module = await import("active-win");
    activeWinLoader = async () => (await module.default()) as ActiveWinResult | undefined;
  }
  return activeWinLoader;
}

async function getScreenshotModule(): Promise<(options?: { format?: string }) => Promise<Buffer>> {
  if (!screenshotModule) {
    const module = await import("screenshot-desktop");
    const impl = (module.default || module) as unknown as (options?: { format?: string }) => Promise<Buffer>;
    screenshotModule = impl;
  }
  return screenshotModule;
}

function classifyKeyboardEvent(event: {
  keycode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): EventInput["keyboardClass"] {
  const keycode = event.keycode ?? 0;
  const modifierKeys = new Set([29, 42, 54, 56, 3612, 3640, 3675, 3676]);
  const navigationKeys = new Set([15, 57, 57416, 57419, 57421, 57424]);
  const editingKeys = new Set([14, 211]);
  const submitKeys = new Set([28, 3613]);

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return "shortcut";
  }
  if (submitKeys.has(keycode)) {
    return "submit";
  }
  if (navigationKeys.has(keycode)) {
    return "navigation";
  }
  if (editingKeys.has(keycode)) {
    return "editing";
  }
  if (modifierKeys.has(keycode) || event.shiftKey) {
    return "modifier";
  }
  if (keycode > 0 && keycode < 70) {
    return "textual";
  }
  return "other";
}

function makeContextSignature(context: CaptureContext): string {
  return [
    context.appName ?? "",
    context.windowTitle ?? "",
    context.url ?? "",
    context.domain ?? "",
    context.excluded ? "excluded" : "included",
  ].join("|");
}

function buildBaseEvent(): Pick<
  EventInput,
  "appName" | "processName" | "windowTitle" | "url" | "domain" | "redactionStatus" | "metadata"
> {
  return {
    appName: currentContext.appName,
    processName: currentContext.processName,
    windowTitle: currentContext.windowTitle,
    url: currentContext.url,
    domain: currentContext.domain,
    redactionStatus: currentContext.excluded ? "excluded" : "none",
    metadata: {},
  };
}

function recordEvent(
  event: Omit<EventInput, "occurredAt" | "sequenceNumber" | "redactionStatus"> & {
    redactionStatus?: EventInput["redactionStatus"];
  }
): void {
  if (!recording || currentContext.excluded || !currentSessionRef) {
    return;
  }

  sequenceNumber += 1;
  eventCount += 1;
  pendingEvents.push({
    ...buildBaseEvent(),
    ...event,
    occurredAt: new Date().toISOString(),
    sequenceNumber,
  });
  updateStatus();
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function createSession(payload: SessionCreateInput): Promise<{ id: string }> {
  return postJson<{ id: string }>(`${config.apiBaseUrl}/sessions`, payload);
}

async function postEvents(sessionId: string, events: EventInput[]): Promise<void> {
  await postJson(`${config.apiBaseUrl}/sessions/${sessionId}/events`, { events });
}

async function postStop(sessionId: string, endedAt: string): Promise<void> {
  await postJson(`${config.apiBaseUrl}/sessions/${sessionId}/stop`, { endedAt });
}

async function postScreenshot(sessionId: string, filePath: string, occurredAt: string): Promise<void> {
  const form = new FormData();
  const fileBuffer = await fs.readFile(filePath);
  form.append("file", new Blob([fileBuffer]), path.basename(filePath));
  form.append("occurredAt", occurredAt);
  form.append("redactionStatus", "pending");

  const response = await fetch(`${config.apiBaseUrl}/sessions/${sessionId}/screenshots`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
}

async function flushPendingEvents(): Promise<void> {
  if (!pendingEvents.length || !currentSessionRef) {
    return;
  }

  const eventsToFlush = [...pendingEvents];
  pendingEvents = [];

  const sessionId = resolveSessionId(currentSessionRef);
  if (!sessionId) {
    await enqueue({
      id: randomUUID(),
      type: "events",
      sessionRef: currentSessionRef,
      payload: { events: eventsToFlush },
    });
    return;
  }

  try {
    await postEvents(sessionId, eventsToFlush);
    markSynced("Events synced");
  } catch (error) {
    apiConnected = false;
    setError(`Failed to upload events: ${String(error)}`);
    await enqueue({
      id: randomUUID(),
      type: "events",
      sessionRef: currentSessionRef,
      payload: { events: eventsToFlush },
    });
  }
}

async function flushQueue(): Promise<void> {
  if (!queue.length) {
    updateStatus();
    return;
  }

  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === "create_session") {
        if (sessionMap[item.sessionRef]) {
          continue;
        }
        const created = await createSession(item.payload);
        sessionMap[item.sessionRef] = created.id;
        currentRemoteSessionId = created.id;
        markSynced(`Session connected: ${created.id}`);
        continue;
      }

      const sessionId = resolveSessionId(item.sessionRef);
      if (!sessionId) {
        remaining.push(item);
        continue;
      }

      if (item.type === "events") {
        await postEvents(sessionId, item.payload.events);
      }

      if (item.type === "screenshot") {
        await postScreenshot(sessionId, item.payload.filePath, item.payload.occurredAt);
        await fs.unlink(item.payload.filePath).catch(() => undefined);
      }

      if (item.type === "stop_session") {
        await postStop(sessionId, item.payload.endedAt);
      }

      markSynced(item.type === "screenshot" ? "Evidence synced" : "Queue synced");
    } catch (error) {
      apiConnected = false;
      setError(`Offline queue flush paused: ${String(error)}`);
      remaining.push(item);
    }
  }

  queue = remaining;
  await persistQueue();
  await persistSessionMap();
  updateStatus();
}

async function refreshActiveContext(): Promise<void> {
  try {
    const activeWin = await getActiveWinLoader();
    const window = await activeWin();
    currentContext = {
      appName: window?.owner?.name ?? null,
      processName: window?.owner?.processName ?? null,
      windowTitle: window?.title ?? null,
      url: window?.url ?? null,
      domain: extractDomain(window?.url ?? null),
      excluded: false,
    };
    currentContext.excluded = matchesExclusions(currentContext);

    const signature = makeContextSignature(currentContext);
    if (recording && signature && signature !== lastContextSignature && !currentContext.excluded) {
      const eventType = currentContext.url && signature.split("|")[2] !== lastContextSignature.split("|")[2]
        ? "navigation"
        : "window_change";
      recordEvent({
        eventType,
        clickX: null,
        clickY: null,
        keyboardClass: null,
        screenshotRef: null,
        redactionNotes: null,
        metadata: {
          contextSync: true,
        },
      });
    }
    lastContextSignature = signature;
    updateStatus();
  } catch (error) {
    setError(`Active window capture unavailable: ${String(error)}`);
  }
}

async function captureScreenshot(): Promise<void> {
  if (!recording || paused || !config.captureScreenshots || !currentSessionRef || currentContext.excluded) {
    return;
  }

  try {
    const screenshot = await getScreenshotModule();
    const occurredAt = new Date().toISOString();
    const buffer = await screenshot({ format: "png" });
    const filePath = path.join(screenshotBufferDir, `${occurredAt.replaceAll(":", "-")}_${randomUUID()}.png`);
    await fs.writeFile(filePath, buffer);
    screenshotCount += 1;

    const sessionId = resolveSessionId(currentSessionRef);
    if (sessionId) {
      try {
        await postScreenshot(sessionId, filePath, occurredAt);
        await fs.unlink(filePath).catch(() => undefined);
        markSynced("Screenshot synced");
        return;
      } catch (error) {
        apiConnected = false;
        setError(`Failed to upload screenshot: ${String(error)}`);
      }
    }

    await enqueue({
      id: randomUUID(),
      type: "screenshot",
      sessionRef: currentSessionRef,
      payload: {
        occurredAt,
        filePath,
        redactionStatus: "pending",
      },
    });
  } catch (error) {
    setError(`Screenshot capture failed: ${String(error)}`);
  }
}

function startIntervals(): void {
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flushPendingEvents();
      void flushQueue();
    }, 4000);
  }

  if (!contextTimer) {
    contextTimer = setInterval(() => {
      if (recording) {
        void refreshActiveContext();
      }
    }, 1000);
  }

  if (!screenshotTimer && recording) {
    screenshotTimer = setInterval(() => {
      void captureScreenshot();
    }, Math.max(1, config.screenshotIntervalSeconds) * 1000);
  }
}

function stopIntervals(): void {
  if (screenshotTimer) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
}

function initialiseHooks(): void {
  try {
    const module = require("uiohook-napi") as { uIOhook?: any };
    const hook = module.uIOhook ?? module;
    hook.on("mousedown", (event: { x?: number; y?: number; button?: number }) => {
      recordEvent({
        eventType: "mouse_click",
        clickX: event.x ?? null,
        clickY: event.y ?? null,
        keyboardClass: null,
        screenshotRef: null,
        redactionNotes: null,
        metadata: {
          button: event.button ?? null,
        },
      });
    });
    hook.on(
      "keydown",
      (event: { keycode?: number; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => {
        recordEvent({
          eventType: "keyboard",
          clickX: null,
          clickY: null,
          keyboardClass: classifyKeyboardEvent(event),
          screenshotRef: null,
          redactionNotes: "Raw text suppressed; stored keyboard class only",
          redactionStatus: "masked",
          metadata: {
            keycode: event.keycode ?? null,
            modifiers: {
              ctrl: Boolean(event.ctrlKey),
              meta: Boolean(event.metaKey),
              alt: Boolean(event.altKey),
              shift: Boolean(event.shiftKey),
            },
          },
        });
      }
    );
    hook.start();
    addActivity("Global keyboard and mouse hooks started");
  } catch (error) {
    setError(`Global input hook unavailable: ${String(error)}`);
  }
}

async function startRecording(payload: WorkerCommand & { type: "start" }): Promise<void> {
  if (recording) {
    addActivity("Recording already in progress");
    return;
  }

  config = RecorderConfigSchema.parse(payload.payload.config);
  await ensureStateDirectories();

  if (paused && currentSessionRef) {
    recording = true;
    paused = false;
    lastContextSignature = "";
    await refreshActiveContext();
    startIntervals();
    addActivity("Recording resumed");
    updateStatus();
    return;
  }

  const sessionPayload: SessionCreateInput = {
    employeeIdentifier: payload.payload.environment.employeeIdentifier,
    machineName: payload.payload.environment.machineName,
    os: payload.payload.environment.os,
    status: "recording",
    startedAt: new Date().toISOString(),
    metadata: {
      recorderVersion: "0.1.0",
      captureMode: "class_only_keyboard",
      screenshotCadenceSeconds: config.screenshotIntervalSeconds,
      screenshotCaptureEnabled: config.captureScreenshots,
    },
  };

  let sessionRef = `local_${randomUUID().slice(0, 8)}`;

  try {
    const created = await createSession(sessionPayload);
    sessionRef = created.id;
    currentRemoteSessionId = created.id;
    markSynced(`Session started: ${created.id}`);
    addActivity(`Remote session created: ${created.id}`);
  } catch (error) {
    apiConnected = false;
    await enqueue({
      id: randomUUID(),
      type: "create_session",
      sessionRef,
      payload: sessionPayload,
    });
    setError(`API unavailable at session start; buffering locally: ${String(error)}`);
    addActivity(`Buffered session locally: ${sessionRef}`);
  }

  currentSessionRef = sessionRef;
  sequenceNumber = 0;
  eventCount = 0;
  screenshotCount = 0;
  recording = true;
  paused = false;
  lastContextSignature = "";
  await refreshActiveContext();
  startIntervals();
  updateStatus();
}

async function pauseRecording(): Promise<void> {
  if (!recording || !currentSessionRef) {
    addActivity("No active recording session to pause");
    return;
  }

  recording = false;
  paused = true;
  stopIntervals();
  await flushPendingEvents();
  addActivity("Recording paused");
  updateStatus();
}

async function stopRecording(): Promise<void> {
  if ((!recording && !paused) || !currentSessionRef) {
    addActivity("No active recording session");
    return;
  }

  recording = false;
  paused = false;
  stopIntervals();
  await flushPendingEvents();

  const endedAt = new Date().toISOString();
  const sessionId = resolveSessionId(currentSessionRef);
  if (sessionId) {
    try {
      await postStop(sessionId, endedAt);
      markSynced(`Session stopped: ${sessionId}`);
      addActivity(`Stopped remote session ${sessionId}`);
    } catch (error) {
      apiConnected = false;
      await enqueue({
        id: randomUUID(),
        type: "stop_session",
        sessionRef: currentSessionRef,
        payload: { endedAt },
      });
      setError(`Failed to stop session remotely: ${String(error)}`);
    }
  } else {
    await enqueue({
      id: randomUUID(),
      type: "stop_session",
      sessionRef: currentSessionRef,
      payload: { endedAt },
    });
  }

  await flushQueue();
  addActivity("Recording stopped");
  currentSessionRef = null;
  currentRemoteSessionId = null;
  lastContextSignature = "";
  updateStatus();
}

async function handleCommand(command: WorkerCommand): Promise<void> {
  if (command.type === "getStatus") {
    updateStatus();
    return;
  }

  if (command.type === "setConfig") {
    config = RecorderConfigSchema.parse(command.payload);
    addActivity("Recorder configuration updated");
    if (recording) {
      stopIntervals();
      startIntervals();
    }
    return;
  }

  if (command.type === "start") {
    await startRecording(command);
    return;
  }

  if (command.type === "pause") {
    await pauseRecording();
    return;
  }

  if (command.type === "stop") {
    await stopRecording();
  }
}

async function bootstrap(): Promise<void> {
  await loadState();
  initialiseHooks();
  startIntervals();
  setInterval(() => {
    void flushQueue();
  }, 12000);
}

let stdinBuffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk;
  const lines = stdinBuffer.split("\n");
  stdinBuffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const command = JSON.parse(line) as WorkerCommand;
      void handleCommand(command);
    } catch (error) {
      setError(`Failed to parse command: ${String(error)}`);
    }
  }
});

void bootstrap();
