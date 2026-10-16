import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  HubAuditEntry,
  HubGroupRole,
  HubGroupState,
  HubOrchestratorState,
  HubSurface,
  HubStatus,
  HubTaskState,
  HubTaskStateRecord,
} from "./types.js";

const DEFAULT_STATE_PATH = join(
  homedir(),
  ".config",
  "comet-agent",
  "hub-orchestrator-state.json",
);

type TargetIds = Record<string, string | number | null>;

export interface InitHubInput {
  goal: string;
  parent_window_id?: number | null;
  hub_tab_id?: number | string | null;
  status?: HubStatus;
  parent_computer_task_url?: string | null;
  evidence_url?: string | null;
  artifact_path?: string | null;
}

export interface UpsertHubGroupInput {
  group_id: number;
  window_id: number;
  title: string;
  role?: HubGroupRole;
  space_url?: string | null;
  space_id?: string | null;
  tab_ids?: number[];
  task_ids?: string[];
  status?: HubStatus;
  evidence_url?: string | null;
  artifact_path?: string | null;
}

export interface UpsertHubTaskInput {
  task_id: string;
  parent_task_id?: string | null;
  surface?: HubSurface | null;
  task_kind?: string | null;
  group_id?: number | null;
  space_id?: string | null;
  space_url?: string | null;
  computer_task_url?: string | null;
  description: string;
  template?: string | null;
  state?: HubTaskState;
  acceptance_criteria?: string[];
  artifact_expectations?: string[];
  result_ref?: string | null;
  completed_at?: string | null;
  evidence_url?: string | null;
  artifact_path?: string | null;
}

export interface AppendHubAuditInput {
  operation: string;
  surface?: HubSurface | null;
  target_ids?: TargetIds;
  from_state?: unknown;
  to_state?: unknown;
  evidence_url?: string | null;
  artifact_path?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultState(goal = "Comet hub orchestration session"): HubOrchestratorState {
  const now = nowIso();
  return {
    schema_version: 1,
    run_id: randomUUID(),
    goal,
    parent_window_id: null,
    hub_tab_id: null,
    parent_computer_task_url: null,
    created_at: now,
    updated_at: now,
    status: "planning",
    groups: [],
    spaces: [],
    tasks: [],
    artifacts: [],
    waiting_items: [],
    audit: [],
  };
}

function isHubState(value: unknown): value is HubOrchestratorState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HubOrchestratorState>;
  return (
    typeof candidate.run_id === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.created_at === "string" &&
    Array.isArray(candidate.groups) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.audit)
  );
}

function normalizeState(state: HubOrchestratorState): HubOrchestratorState {
  return {
    ...state,
    schema_version: 1,
    parent_computer_task_url: state.parent_computer_task_url ?? null,
    spaces: state.spaces ?? [],
    artifacts: state.artifacts ?? [],
    waiting_items: state.waiting_items ?? [],
    audit: state.audit.map((entry) => ({
      ...entry,
      audit_id: entry.audit_id ?? entry.id,
      targets: entry.targets ?? entry.target_ids,
      actor: entry.actor ?? "codex",
    })),
  };
}

export class HubStateStore {
  readonly path: string;

  constructor(path = process.env.COMET_HUB_STATE_PATH || DEFAULT_STATE_PATH) {
    this.path = path;
  }

  read(): HubOrchestratorState {
    if (!existsSync(this.path)) return defaultState();
    const parsed = JSON.parse(readFileSync(this.path, "utf-8")) as unknown;
    if (!isHubState(parsed)) {
      throw new Error(`Invalid hub state file: ${this.path}`);
    }
    return normalizeState(parsed);
  }

  initialize(input: InitHubInput): HubOrchestratorState {
    const now = nowIso();
    const state: HubOrchestratorState = {
      ...defaultState(input.goal),
      parent_window_id: input.parent_window_id ?? null,
      hub_tab_id: input.hub_tab_id ?? null,
      parent_computer_task_url: input.parent_computer_task_url ?? input.evidence_url ?? null,
      created_at: now,
      updated_at: now,
      status: input.status ?? "planning",
    };

    state.audit.push(this.makeAuditEntry({
      operation: "hub.init",
      target_ids: {
        run_id: state.run_id,
        parent_window_id: state.parent_window_id,
        hub_tab_id: state.hub_tab_id,
      },
      from_state: null,
      to_state: {
        goal: state.goal,
        status: state.status,
      },
      evidence_url: input.evidence_url ?? null,
      artifact_path: input.artifact_path ?? null,
    }));

    this.write(state);
    return state;
  }

  upsertGroup(input: UpsertHubGroupInput): HubOrchestratorState {
    const state = this.read();
    const index = state.groups.findIndex((group) => group.group_id === input.group_id);
    const from = index === -1 ? null : clone(state.groups[index]);
    const existing = index === -1 ? null : state.groups[index];

    const group: HubGroupState = {
      group_id: input.group_id,
      window_id: input.window_id,
      title: input.title,
      role: input.role ?? existing?.role ?? "space-orchestrator",
      space_url: input.space_url ?? existing?.space_url ?? null,
      space_id: input.space_id ?? existing?.space_id ?? null,
      tab_ids: input.tab_ids ?? existing?.tab_ids ?? [],
      task_ids: input.task_ids ?? existing?.task_ids ?? [],
      status: input.status ?? existing?.status ?? state.status,
      created_at: existing?.created_at ?? nowIso(),
    };

    if (index === -1) state.groups.push(group);
    else state.groups[index] = group;

    state.audit.push(this.makeAuditEntry({
      operation: "hub.group.upsert",
      target_ids: {
        run_id: state.run_id,
        group_id: group.group_id,
        window_id: group.window_id,
      },
      from_state: from,
      to_state: group,
      evidence_url: input.evidence_url ?? null,
      artifact_path: input.artifact_path ?? null,
    }));

    return this.touchAndWrite(state);
  }

  upsertTask(input: UpsertHubTaskInput): HubOrchestratorState {
    const state = this.read();
    const index = state.tasks.findIndex((task) => task.task_id === input.task_id);
    const from = index === -1 ? null : clone(state.tasks[index]);
    const existing = index === -1 ? null : state.tasks[index];
    const createdAt = existing?.created_at ?? nowIso();

    const task: HubTaskStateRecord = {
      task_id: input.task_id,
      parent_task_id: input.parent_task_id ?? existing?.parent_task_id ?? null,
      surface: input.surface ?? existing?.surface ?? null,
      task_kind: input.task_kind ?? existing?.task_kind ?? null,
      group_id: input.group_id ?? existing?.group_id ?? null,
      space_id: input.space_id ?? existing?.space_id ?? null,
      space_url: input.space_url ?? existing?.space_url ?? null,
      computer_task_url: input.computer_task_url ?? existing?.computer_task_url ?? null,
      description: input.description,
      template: input.template ?? existing?.template ?? null,
      state: input.state ?? existing?.state ?? "pending",
      acceptance_criteria: input.acceptance_criteria ?? existing?.acceptance_criteria ?? [],
      artifact_expectations: input.artifact_expectations ?? existing?.artifact_expectations ?? [],
      result_ref: input.result_ref ?? existing?.result_ref ?? null,
      created_at: createdAt,
      updated_at: nowIso(),
      completed_at: input.completed_at ?? existing?.completed_at ?? null,
    };

    if (index === -1) state.tasks.push(task);
    else state.tasks[index] = task;

    if (task.group_id !== null) {
      const group = state.groups.find((candidate) => candidate.group_id === task.group_id);
      if (group && !group.task_ids.includes(task.task_id)) {
        group.task_ids.push(task.task_id);
      }
    }

    state.audit.push(this.makeAuditEntry({
      operation: "hub.task.upsert",
      target_ids: {
        run_id: state.run_id,
        task_id: task.task_id,
        group_id: task.group_id,
      },
      from_state: from,
      to_state: task,
      evidence_url: input.evidence_url ?? null,
      artifact_path: input.artifact_path ?? null,
    }));

    return this.touchAndWrite(state);
  }

  appendAudit(input: AppendHubAuditInput): HubOrchestratorState {
    const state = this.read();
    state.audit.push(this.makeAuditEntry({
      operation: input.operation,
      surface: input.surface ?? null,
      target_ids: {
        run_id: state.run_id,
        ...(input.target_ids ?? {}),
      },
      from_state: input.from_state ?? null,
      to_state: input.to_state ?? null,
      evidence_url: input.evidence_url ?? null,
      artifact_path: input.artifact_path ?? null,
    }));
    return this.touchAndWrite(state);
  }

  private makeAuditEntry(input: AppendHubAuditInput & { target_ids: TargetIds }): HubAuditEntry {
    const id = randomUUID();
    return {
      id,
      audit_id: id,
      operation: input.operation,
      surface: input.surface ?? null,
      target_ids: input.target_ids,
      targets: input.target_ids,
      from_state: input.from_state,
      to_state: input.to_state,
      evidence_url: input.evidence_url ?? null,
      artifact_path: input.artifact_path ?? null,
      actor: "codex",
      timestamp: nowIso(),
    };
  }

  private touchAndWrite(state: HubOrchestratorState): HubOrchestratorState {
    state.updated_at = nowIso();
    this.write(state);
    return state;
  }

  private write(state: HubOrchestratorState): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmpPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf-8");
    renameSync(tmpPath, this.path);
  }
}
