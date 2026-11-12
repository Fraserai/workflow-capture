import { z } from "zod";

export const sessionStatusValues = ["pending", "recording", "stopped", "processed"] as const;
export const eventTypeValues = ["mouse_click", "keyboard", "window_change", "navigation", "system"] as const;
export const keyboardClassValues = [
  "navigation",
  "modifier",
  "editing",
  "submit",
  "system",
  "shortcut",
  "textual",
  "other"
] as const;

export const SessionStatusSchema = z.enum(sessionStatusValues);
export const EventTypeSchema = z.enum(eventTypeValues);
export const KeyboardClassSchema = z.enum(keyboardClassValues);

export const RecorderConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  organizationName: z.string().min(1).max(128).default("Your organization"),
  captureScreenshots: z.boolean().default(true),
  screenshotIntervalSeconds: z.number().int().min(1).max(300).default(5),
  excludedApps: z.array(z.string().min(1)).default([]),
  excludedDomains: z.array(z.string().min(1)).default([]),
  debugMode: z.boolean().default(false),
  hasCompletedOnboarding: z.boolean().default(false)
});

export const SessionCreateSchema = z.object({
  employeeIdentifier: z.string().min(1).max(128),
  machineName: z.string().min(1).max(128),
  os: z.string().min(1).max(64),
  status: SessionStatusSchema.default("recording"),
  startedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({})
});

export const EventInputSchema = z.object({
  occurredAt: z.string().datetime(),
  sequenceNumber: z.number().int().nonnegative(),
  eventType: EventTypeSchema,
  appName: z.string().nullable().optional(),
  processName: z.string().nullable().optional(),
  windowTitle: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  clickX: z.number().nullable().optional(),
  clickY: z.number().nullable().optional(),
  keyboardClass: KeyboardClassSchema.nullable().optional(),
  screenshotRef: z.string().nullable().optional(),
  redactionStatus: z.string().default("none"),
  redactionNotes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({})
});

export const ScreenshotSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  occurredAt: z.string().datetime(),
  fileName: z.string(),
  relativePath: z.string(),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  redactionStatus: z.string(),
  createdAt: z.string().datetime()
});

export const SessionSummarySchema = z.object({
  id: z.string(),
  employeeIdentifier: z.string(),
  machineName: z.string(),
  os: z.string(),
  status: SessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  eventCount: z.number().int().nonnegative(),
  screenshotCount: z.number().int().nonnegative(),
  latestTaskTraceId: z.string().nullable()
});

export const EventSchema = EventInputSchema.extend({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string().datetime()
});

export const TaskStepSchema = z.object({
  stepIndex: z.number().int().positive(),
  action: z.string(),
  target: z.string(),
  app: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  evidence: z.array(z.string()),
  eventIds: z.array(z.string())
});

export const TaskTraceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  inferredTaskName: z.string(),
  durationSeconds: z.number().nonnegative(),
  outcome: z.string(),
  steps: z.array(TaskStepSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const SessionDetailSchema = SessionSummarySchema.extend({
  events: z.array(EventSchema),
  screenshots: z.array(ScreenshotSchema),
  latestTaskTrace: TaskTraceSchema.nullable()
});

export const ReplayEntrySchema = z.object({
  event: EventSchema,
  screenshot: ScreenshotSchema.nullable()
});

export const SessionReplaySchema = z.object({
  session: SessionSummarySchema,
  timeline: z.array(ReplayEntrySchema)
});

export const NormalizeRequestSchema = z.object({
  sessionId: z.string().min(1),
  force: z.boolean().default(false)
});

export const ExportRecordSchema = z.object({
  recordType: z.enum(["session", "task_trace"]),
  sessionId: z.string(),
  payload: z.record(z.unknown())
});

export type RecorderConfig = z.infer<typeof RecorderConfigSchema>;
export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;
export type EventInput = z.infer<typeof EventInputSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type Event = z.infer<typeof EventSchema>;
export type Screenshot = z.infer<typeof ScreenshotSchema>;
export type TaskStep = z.infer<typeof TaskStepSchema>;
export type TaskTrace = z.infer<typeof TaskTraceSchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export type SessionReplay = z.infer<typeof SessionReplaySchema>;
export type NormalizeRequest = z.infer<typeof NormalizeRequestSchema>;
export type ExportRecord = z.infer<typeof ExportRecordSchema>;
