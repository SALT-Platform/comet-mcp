import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HubStateStore } from "../../src/hub-state.js";

let tempDirs: string[] = [];

function makeStore(): HubStateStore {
  const dir = mkdtempSync(join(tmpdir(), "comet-hub-state-"));
  tempDirs.push(dir);
  return new HubStateStore(join(dir, "hub-orchestrator-state.json"));
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("HubStateStore", () => {
  it("initializes the parent hub state with an audit row", () => {
    const store = makeStore();

    const state = store.initialize({
      goal: "Coordinate one Comet parent window",
      parent_window_id: 12,
      hub_tab_id: 34,
      status: "running",
    });

    expect(state.run_id).toBeTruthy();
    expect(state.schema_version).toBe(1);
    expect(state.goal).toBe("Coordinate one Comet parent window");
    expect(state.parent_window_id).toBe(12);
    expect(state.hub_tab_id).toBe(34);
    expect(state.status).toBe("running");
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0].operation).toBe("hub.init");
    expect(state.audit[0].audit_id).toBe(state.audit[0].id);
    expect(state.audit[0].actor).toBe("codex");
  });

  it("upserts tab group state and links later tasks back to the group", () => {
    const store = makeStore();
    store.initialize({ goal: "Run Spaces orchestration" });

    const withGroup = store.upsertGroup({
      group_id: 701,
      window_id: 9,
      title: "Deep Research",
      role: "space-orchestrator",
      space_url: "https://www.perplexity.ai/spaces/example",
      space_id: "example",
      tab_ids: [1, 2],
      status: "running",
    });

    expect(withGroup.groups).toHaveLength(1);
    expect(withGroup.groups[0].task_ids).toEqual([]);

    const withTask = store.upsertTask({
      task_id: "task-1",
      parent_task_id: "parent-1",
      surface: "space",
      task_kind: "research",
      group_id: 701,
      space_id: "example",
      space_url: "https://www.perplexity.ai/spaces/example",
      description: "Collect final citations",
      template: "research",
      state: "completed",
      acceptance_criteria: ["citations listed"],
      artifact_expectations: ["markdown"],
      result_ref: "/tmp/result.md",
      completed_at: "2026-05-29T00:00:00.000Z",
    });

    expect(withTask.tasks).toHaveLength(1);
    expect(withTask.tasks[0].state).toBe("completed");
    expect(withTask.tasks[0].parent_task_id).toBe("parent-1");
    expect(withTask.tasks[0].surface).toBe("space");
    expect(withTask.tasks[0].space_id).toBe("example");
    expect(withTask.groups[0].task_ids).toEqual(["task-1"]);
    expect(withTask.audit.map((entry) => entry.operation)).toEqual([
      "hub.init",
      "hub.group.upsert",
      "hub.task.upsert",
    ]);
  });

  it("appends explicit audit rows with target IDs and evidence", () => {
    const store = makeStore();
    store.initialize({ goal: "Audit all active controls" });

    const state = store.appendAudit({
      operation: "hub.collect",
      surface: "computer",
      target_ids: { group_id: 701, task_id: "task-1" },
      from_state: { state: "running" },
      to_state: { state: "reported" },
      evidence_url: "https://www.perplexity.ai/computer/tasks/example",
    });

    expect(state.audit).toHaveLength(2);
    expect(state.audit[1].operation).toBe("hub.collect");
    expect(state.audit[1].surface).toBe("computer");
    expect(state.audit[1].targets?.task_id).toBe("task-1");
    expect(state.audit[1].target_ids.group_id).toBe(701);
    expect(state.audit[1].evidence_url).toContain("perplexity.ai");
  });
});
