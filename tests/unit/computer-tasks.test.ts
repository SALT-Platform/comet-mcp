import { describe, expect, it } from "vitest";
import {
  buildComputerTaskRecord,
  extractWaitingPrompt,
  inferComputerTaskState,
  listComputerArtifacts,
  listComputerTasks,
  parseComputerArtifactId,
  parseComputerTaskId,
} from "../../src/computer-tasks.js";
import type { HubOrchestratorState, TabInfo } from "../../src/types.js";

function tab(input: Partial<TabInfo> & Pick<TabInfo, "title" | "url">): TabInfo {
  return {
    id: input.id ?? 1,
    groupId: input.groupId ?? -1,
    windowId: input.windowId ?? 10,
    index: input.index ?? 0,
    title: input.title,
    url: input.url,
    active: input.active ?? false,
  };
}

describe("computer task inventory", () => {
  it("parses task and artifact ids from Perplexity Computer URLs", () => {
    const taskUrl = "https://www.perplexity.ai/computer/tasks/40aa19a9-0e85-4b33-953a-30c565478139";
    const artifactUrl = "https://www.perplexity.ai/computer/a/40aa19a9-0e85-4b33-953a-30c565478139";

    expect(parseComputerTaskId(taskUrl)).toBe("40aa19a9-0e85-4b33-953a-30c565478139");
    expect(parseComputerArtifactId(artifactUrl)).toBe("40aa19a9-0e85-4b33-953a-30c565478139");
  });

  it("infers waiting and terminal task states from visible titles", () => {
    expect(inferComputerTaskState("GitHub Actions Review Waiting for your response: approve next step")).toBe("waiting");
    expect(extractWaitingPrompt("Waiting for your response: approve next step")).toBe("approve next step");
    expect(inferComputerTaskState("Run complete")).toBe("complete");
    expect(inferComputerTaskState("Blocked on auth")).toBe("blocked");
  });

  it("merges open Computer task tabs with persisted hub task records", () => {
    const tabs = [
      tab({
        id: 101,
        groupId: 501,
        title: "Comet Orchestrator Hub and Spoke Migration Waiting for your response",
        url: "https://www.perplexity.ai/computer/tasks/40aa19a9-0e85-4b33-953a-30c565478139",
      }),
    ];
    const hubState: HubOrchestratorState = {
      run_id: "run-1",
      goal: "Coordinate Comet",
      parent_window_id: null,
      hub_tab_id: null,
      created_at: "2026-05-29T00:00:00.000Z",
      updated_at: "2026-05-29T00:00:00.000Z",
      status: "running",
      groups: [],
      tasks: [
        {
          task_id: "40aa19a9-0e85-4b33-953a-30c565478139",
          group_id: 701,
          description: "Persisted parent task",
          template: "computer-task",
          state: "reported",
          result_ref: "https://www.perplexity.ai/computer/tasks/40aa19a9-0e85-4b33-953a-30c565478139",
          created_at: "2026-05-29T00:00:00.000Z",
          completed_at: null,
        },
        {
          task_id: "child-1",
          group_id: null,
          description: "Persisted child task",
          template: "research",
          state: "pending",
          result_ref: null,
          created_at: "2026-05-29T00:00:00.000Z",
          completed_at: null,
        },
      ],
      audit: [],
    };

    const tasks = listComputerTasks(tabs, hubState);

    expect(tasks).toHaveLength(2);
    expect(tasks.find((taskRecord) => taskRecord.task_id === "40aa19a9-0e85-4b33-953a-30c565478139")?.group_id).toBe(701);
    expect(tasks.find((taskRecord) => taskRecord.task_id === "40aa19a9-0e85-4b33-953a-30c565478139")?.state).toBe("complete");
    expect(tasks.find((taskRecord) => taskRecord.task_id === "child-1")?.source).toBe("hub-state");
  });

  it("builds queued records for new coordination tasks", () => {
    const record = buildComputerTaskRecord({
      description: "Validate child output",
      task_kind: "validation",
      parent_task_id: "parent-1",
      selected_space_id: "space-1",
      group_id: 7,
    });

    expect(record.task_id).toBeTruthy();
    expect(record.state).toBe("queued");
    expect(record.task_kind).toBe("validation");
    expect(record.parent_task_id).toBe("parent-1");
    expect(record.selected_space_id).toBe("space-1");
    expect(record.group_id).toBe(7);
  });

  it("lists artifact tabs for Computer outputs", () => {
    const artifacts = listComputerArtifacts([
      tab({
        title: "Spec artifact",
        url: "https://www.perplexity.ai/computer/a/40aa19a9-0e85-4b33-953a-30c565478139",
      }),
      tab({ title: "Other", url: "https://www.perplexity.ai/" }),
    ]);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe("Spec artifact");
  });
});
