// Type definitions for CDP client and Comet MCP Server

export interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

export interface CDPVersion {
  Browser: string;
  "Protocol-Version": string;
  "User-Agent": string;
  "V8-Version": string;
  "WebKit-Version": string;
  webSocketDebuggerUrl: string;
}

export interface NavigateResult {
  frameId: string;
  loaderId?: string;
  errorText?: string;
}

export interface ScreenshotResult {
  data: string; // Base64 encoded
}

export interface EvaluateResult {
  result: {
    type: string;
    value?: unknown;
    description?: string;
    objectId?: string;
  };
  exceptionDetails?: {
    text: string;
    exception?: {
      description?: string;
    };
  };
}

export interface CometState {
  connected: boolean;
  port: number;
  currentUrl?: string;
  activeTabId?: string;
}

// ─── Unified Orchestration Types ─────────────────────────────────
// Canonical definitions for the orchestration layer.
// MCP-boundary types (tool-schemas.ts) re-export from here.

export type ServerName = "comet-mcp" | "comet-browser";
export type ServerAlias = "mcp" | "browser";
export type ToolCategory = "ai" | "dom" | "tab" | "monitor" | "meta";
export type TaskState = "pending" | "running" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type HealthLevel = "healthy" | "unreachable" | "degraded" | "unknown";
export type ComponentName = "browser" | "comet-mcp" | "comet-monitor" | "extension";

export const SERVER_ALIAS_MAP: Record<ServerAlias, ServerName> = {
  mcp: "comet-mcp",
  browser: "comet-browser",
};

export const SERVER_NAME_TO_ALIAS: Record<ServerName, ServerAlias> = {
  "comet-mcp": "mcp",
  "comet-browser": "browser",
};

export const TOOL_COLLISIONS: Record<string, ServerName> = {
  comet_connect: "comet-mcp",
  comet_screenshot: "comet-mcp",
};

export interface ToolDescriptor {
  name: string;
  qualifiedName: string;
  server: ServerName;
  category: ToolCategory;
  schema: Record<string, unknown>;
  description: string;
  isCanonical: boolean;
}

export interface ToolInvocation {
  toolName: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  server: ServerName;
  success: boolean;
  data: unknown;
  duration_ms: number;
  error?: string;
}

// ─── Task Queue & Delegation ────────────────────────────────────

export interface TaskStep {
  toolName: string;
  server: ServerName;
  params: Record<string, unknown>;
  result: unknown | null;
  status: StepStatus;
  duration_ms: number | null;
}

export interface TaskDelegation {
  id: string;
  description: string;
  state: TaskState;
  targetTabId: string | null;
  steps: TaskStep[];
  currentStepIndex: number;
  timeout_ms: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface TaskResult {
  status: "pending" | "success" | "failure" | "partial" | "cancelled";
  payload: unknown;
  duration_ms: number;
  tools_invoked: string[];
  steps_completed: number;
  steps_total: number;
  error?: TaskError;
}

export interface TaskError {
  code: string;
  message: string;
  recoverable: boolean;
  failedStep?: number;
}

// ─── Health ─────────────────────────────────────────────────────

export interface ComponentHealthResult {
  name: ComponentName;
  status: HealthLevel;
  reason: string | null;
  latency_ms: number | null;
}

export interface HealthCheckResult {
  overall: "healthy" | "degraded" | "down";
  components: Record<string, ComponentHealthResult>;
  checkedAt: number;
  duration_ms: number;
}

// ─── Dormancy ───────────────────────────────────────────────────

export interface WakeResult {
  success: boolean;
  technique: "page_target" | "management_toggle" | "none";
  attempts: number;
  duration_ms: number;
  error?: string;
}

// ─── Monitor ────────────────────────────────────────────────────

export interface MonitorState {
  available: boolean;
  reason?: string;
  timestamp?: string;
  windows?: Array<{
    index: number;
    title: string;
    x: number;
    y: number;
    w: number;
    h: number;
    display: string;
    fullscreen: boolean;
  }>;
  window_count?: number;
  tabs?: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
  }>;
  tab_count?: number;
}

// ─── Task Templates ─────────────────────────────────────────────

export interface TaskTemplateStep {
  toolName: string;
  server: ServerName;
  paramTemplate: Record<string, unknown>;
  description: string;
  optional?: boolean;
}

export interface TaskTemplate {
  name: string;
  description: string;
  triggerPatterns: string[];
  defaultParams: Record<string, unknown>;
  steps: TaskTemplateStep[];
}

// ─── Delegate Enrichment (no-match fallback per NC-7) ───────────

export interface TemplateSuggestion {
  name: string;
  description: string;
  confidence: number;
}

export interface DelegateEnrichmentResponse {
  matched: false;
  description: string;
  available_templates: TemplateSuggestion[];
  tool_inventory: Array<{ name: string; category: string; server: string }>;
  server_health: Record<string, HealthLevel>;
}

// ---- Tab Groups (via extension service worker) ----

export type TabGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

export interface TabGroup {
  id: number;
  collapsed: boolean;
  color: TabGroupColor;
  title: string;
  windowId: number;
}

export interface TabInfo {
  id: number;
  groupId: number; // -1 if ungrouped
  windowId: number;
  index: number;
  title: string;
  url: string;
  active: boolean;
}

// ---- Parent Hub Orchestration State ----

export type HubStatus =
  | "initializing"
  | "planning"
  | "active"
  | "running"
  | "collecting"
  | "closing"
  | "closed"
  | "blocked"
  | "completed"
  | "archived";
export type HubGroupRole =
  | "hub"
  | "epic"
  | "story"
  | "spec"
  | "task"
  | "validation"
  | "computer-hub"
  | "space-orchestrator"
  | "research"
  | "browser-control"
  | "computer-task"
  | "custom";
export type HubTaskState =
  | TaskState
  | "queued"
  | "dispatched"
  | "waiting_response"
  | "reported";
export type HubSurface = "computer" | "space" | "sidecar" | "browser" | "shortwave";

export interface HubAuditEntry {
  id: string;
  audit_id?: string;
  operation: string;
  surface?: HubSurface | null;
  target_ids: Record<string, string | number | null>;
  targets?: Record<string, string | number | null>;
  from_state: unknown;
  to_state: unknown;
  evidence_url: string | null;
  artifact_path: string | null;
  actor?: string;
  timestamp: string;
}

export interface HubGroupState {
  group_id: number;
  window_id: number;
  title: string;
  role: HubGroupRole;
  space_url: string | null;
  space_id?: string | null;
  tab_ids: number[];
  task_ids: string[];
  status: HubStatus;
  created_at?: string;
}

export interface HubTaskStateRecord {
  task_id: string;
  parent_task_id?: string | null;
  surface?: HubSurface | null;
  task_kind?: string | null;
  group_id: number | null;
  space_id?: string | null;
  space_url?: string | null;
  computer_task_url?: string | null;
  description: string;
  template: string | null;
  state: HubTaskState;
  acceptance_criteria?: string[];
  artifact_expectations?: string[];
  result_ref: string | null;
  created_at: string;
  updated_at?: string;
  completed_at: string | null;
}

export interface HubSpaceRecord {
  space_id: string;
  space_url: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  skills: string[];
  files: string[];
  links: string[];
  domains?: string[];
  last_used_at?: string | null;
  success_count?: number;
}

export interface HubArtifactRecord {
  artifact_id: string;
  task_id: string | null;
  group_id?: number | null;
  url: string;
  title: string;
  kind?: string | null;
  produced_at?: string | null;
  validated?: boolean;
}

export interface HubWaitingItem {
  task_id: string;
  prompt: string;
  detected_at: string;
  resolved_at: string | null;
  response: string | null;
}

export interface HubOrchestratorState {
  schema_version: 1;
  run_id: string;
  goal: string;
  parent_window_id: number | null;
  hub_tab_id: number | string | null;
  parent_computer_task_url: string | null;
  created_at: string;
  updated_at: string;
  status: HubStatus;
  groups: HubGroupState[];
  spaces: HubSpaceRecord[];
  tasks: HubTaskStateRecord[];
  artifacts: HubArtifactRecord[];
  waiting_items: HubWaitingItem[];
  audit: HubAuditEntry[];
}
