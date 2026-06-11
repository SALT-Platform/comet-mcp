import { randomUUID } from "node:crypto";
import type { HubOrchestratorState, HubTaskStateRecord, TabInfo } from "./types.js";

export type ComputerTaskKind =
  | "epic"
  | "story"
  | "spec"
  | "step"
  | "microtask"
  | "validation"
  | "research"
  | "task";

export type ComputerTaskSurfaceState =
  | "queued"
  | "running"
  | "waiting"
  | "complete"
  | "blocked"
  | "archived"
  | "unknown";

export interface ComputerTaskRecord {
  task_id: string;
  task_url: string | null;
  parent_task_id: string | null;
  task_kind: ComputerTaskKind;
  state: ComputerTaskSurfaceState;
  title: string;
  waiting_prompt: string | null;
  selected_space_id: string | null;
  group_id: number | null;
  tab_id: number | null;
  window_id: number | null;
  artifact_ids: string[];
  source: "tab" | "hub-state";
  result_ref: string | null;
}

export interface ComputerTaskCreateInput {
  description: string;
  task_kind?: ComputerTaskKind;
  parent_task_id?: string | null;
  selected_space_id?: string | null;
  group_id?: number | null;
  task_url?: string | null;
}

export interface ComputerArtifactRecord {
  artifact_id: string;
  artifact_url: string;
  title: string;
  producing_task_id: string | null;
  tab_id: number | null;
  window_id: number | null;
}

const TASK_RE = /\/computer\/tasks\/([0-9a-fA-F-]{20,})/;
const ARTIFACT_RE = /\/computer\/a\/([0-9a-fA-F-]{20,})/;

export function isComputerTaskUrl(url: string | null | undefined): boolean {
  return Boolean(url && TASK_RE.test(url));
}

export function parseComputerTaskId(url: string | null | undefined): string | null {
  if (!url) return null;
  return TASK_RE.exec(url)?.[1] ?? null;
}

export function parseComputerArtifactId(url: string | null | undefined): string | null {
  if (!url) return null;
  return ARTIFACT_RE.exec(url)?.[1] ?? null;
}

export function inferComputerTaskState(text: string): ComputerTaskSurfaceState {
  const lower = text.toLowerCase();
  if (lower.includes("waiting for your response")) return "waiting";
  if (lower.includes("blocked")) return "blocked";
  if (lower.includes("archived")) return "archived";
  if (lower.includes("complete") || lower.includes("completed") || lower.includes("done")) {
    return "complete";
  }
  if (lower.trim()) return "running";
  return "unknown";
}

export function extractWaitingPrompt(text: string): string | null {
  const marker = /waiting for your response[:\s-]*(.*)$/i.exec(text);
  const prompt = marker?.[1]?.trim();
  return prompt || null;
}

export function listComputerArtifacts(
  tabs: Pick<TabInfo, "id" | "windowId" | "title" | "url">[],
): ComputerArtifactRecord[] {
  return tabs.flatMap((tab) => {
    const artifactId = parseComputerArtifactId(tab.url);
    if (!artifactId) return [];
    return [{
      artifact_id: artifactId,
      artifact_url: tab.url,
      title: tab.title,
      producing_task_id: null,
      tab_id: tab.id,
      window_id: tab.windowId,
    }];
  });
}

export function buildComputerTaskRecord(input: ComputerTaskCreateInput): ComputerTaskRecord {
  const taskId = parseComputerTaskId(input.task_url) ?? randomUUID();
  return {
    task_id: taskId,
    task_url: input.task_url ?? null,
    parent_task_id: input.parent_task_id ?? null,
    task_kind: input.task_kind ?? "task",
    state: "queued",
    title: input.description,
    waiting_prompt: null,
    selected_space_id: input.selected_space_id ?? null,
    group_id: input.group_id ?? null,
    tab_id: null,
    window_id: null,
    artifact_ids: [],
    source: "hub-state",
    result_ref: input.task_url ?? null,
  };
}

export function listComputerTasks(
  tabs: Pick<TabInfo, "id" | "groupId" | "windowId" | "title" | "url">[],
  hubState?: HubOrchestratorState,
): ComputerTaskRecord[] {
  const records = new Map<string, ComputerTaskRecord>();

  for (const tab of tabs) {
    const taskId = parseComputerTaskId(tab.url);
    if (!taskId) continue;
    records.set(taskId, {
      task_id: taskId,
      task_url: tab.url,
      parent_task_id: null,
      task_kind: "task",
      state: inferComputerTaskState(tab.title),
      title: tab.title,
      waiting_prompt: extractWaitingPrompt(tab.title),
      selected_space_id: null,
      group_id: tab.groupId === -1 ? null : tab.groupId,
      tab_id: tab.id,
      window_id: tab.windowId,
      artifact_ids: [],
      source: "tab",
      result_ref: tab.url,
    });
  }

  for (const task of hubState?.tasks ?? []) {
    const existing = records.get(task.task_id);
    if (existing) {
      existing.group_id = task.group_id ?? existing.group_id;
      existing.result_ref = task.result_ref ?? existing.result_ref;
      existing.state = mapHubTaskState(task);
      continue;
    }
    records.set(task.task_id, fromHubTask(task));
  }

  return [...records.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function fromHubTask(task: HubTaskStateRecord): ComputerTaskRecord {
  return {
    task_id: task.task_id,
    task_url: task.computer_task_url ?? (task.result_ref?.includes("/computer/tasks/") ? task.result_ref : null),
    parent_task_id: task.parent_task_id ?? null,
    task_kind: (task.task_kind as ComputerTaskKind | null) ?? "task",
    state: mapHubTaskState(task),
    title: task.description,
    waiting_prompt: null,
    selected_space_id: task.space_id ?? null,
    group_id: task.group_id,
    tab_id: null,
    window_id: null,
    artifact_ids: [],
    source: "hub-state",
    result_ref: task.result_ref,
  };
}

function mapHubTaskState(task: HubTaskStateRecord): ComputerTaskSurfaceState {
  switch (task.state) {
    case "pending":
    case "queued":
    case "dispatched":
      return "queued";
    case "running":
      return "running";
    case "waiting_response":
      return "waiting";
    case "completed":
    case "reported":
      return "complete";
    case "failed":
      return "blocked";
    case "cancelled":
      return "archived";
    default:
      return "unknown";
  }
}
