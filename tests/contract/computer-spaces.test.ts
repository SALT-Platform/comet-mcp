import { describe, expect, it } from "vitest";

const API_BASE = process.env.COMET_API_URL || "http://127.0.0.1:3456";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(new URL(path, API_BASE).toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postJson(path: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(new URL(path, API_BASE).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

describe("Computer and Spaces HTTP contracts", () => {
  it("lists Computer tasks with stable coordination fields", async () => {
    const payload = await getJson("/api/computer/tasks");

    expect(payload).toHaveProperty("tasks");
    const tasks = (payload as { tasks: unknown[] }).tasks;
    expect(Array.isArray(tasks)).toBe(true);
    if (tasks.length > 0) {
      expect(tasks[0]).toHaveProperty("task_id");
      expect(tasks[0]).toHaveProperty("state");
      expect(tasks[0]).toHaveProperty("source");
      expect(tasks[0]).toHaveProperty("result_ref");
    }
  });

  it("creates a Computer task coordination record and reports status", async () => {
    const created = await postJson("/api/computer/tasks", {
      description: "contract validator Computer task",
      task_kind: "validation",
    });
    const task = (created as { task: { task_id: string; state: string } }).task;

    expect(task.task_id).toBeTruthy();
    expect(task.state).toBe("queued");

    const status = await getJson(`/api/computer/tasks/status?task_id=${encodeURIComponent(task.task_id)}`);
    expect((status as { task: { task_id: string } }).task.task_id).toBe(task.task_id);

    const pathStatus = await getJson(`/api/computer/tasks/${encodeURIComponent(task.task_id)}`);
    expect((pathStatus as { task: { task_id: string } }).task.task_id).toBe(task.task_id);

    const response = await postJson(`/api/computer/tasks/${encodeURIComponent(task.task_id)}/respond`, {
      response: "contract validator response",
    });
    expect(response).toHaveProperty("accepted", true);
  });

  it("lists Computer artifacts", async () => {
    const payload = await getJson("/api/computer/tasks/artifacts");

    expect(payload).toHaveProperty("artifacts");
    expect(Array.isArray((payload as { artifacts: unknown[] }).artifacts)).toBe(true);
  });

  it("lists and ranks Spaces", async () => {
    const payload = await getJson("/api/spaces");
    expect(payload).toHaveProperty("spaces");
    const spaces = (payload as { spaces: Array<{ space_id: string }> }).spaces;
    expect(Array.isArray(spaces)).toBe(true);

    const ranked = await getJson("/api/spaces/search?q=github%20pull%20request");
    expect(ranked).toHaveProperty("spaces");
    expect(Array.isArray((ranked as { spaces: unknown[] }).spaces)).toBe(true);

    const postRanked = await postJson("/api/spaces/search", {
      requirements: ["github", "pull request"],
      task_kind: "validation",
    });
    expect(postRanked).toHaveProperty("spaces");
    expect(Array.isArray((postRanked as { spaces: unknown[] }).spaces)).toBe(true);

    if (spaces.length > 0) {
      const metadata = await getJson(`/api/spaces/metadata?space_id=${encodeURIComponent(spaces[0].space_id)}`);
      expect(metadata).toHaveProperty("space");
      expect((metadata as { space: { space_id: string } }).space.space_id).toBe(spaces[0].space_id);

      const pathMetadata = await getJson(`/api/spaces/${encodeURIComponent(spaces[0].space_id)}`);
      expect((pathMetadata as { space: { space_id: string } }).space.space_id).toBe(spaces[0].space_id);
    }
  });

  it("dispatches a Space coordination task when a Space is open", async () => {
    const payload = await getJson("/api/spaces");
    const spaces = (payload as { spaces: Array<{ space_id: string }> }).spaces;
    if (spaces.length === 0) return;

    const dispatched = await postJson("/api/spaces/dispatch", {
      space_id: spaces[0].space_id,
      description: "contract validator Space dispatch",
      task_kind: "validation",
    });

    expect(dispatched).toHaveProperty("task");
    expect(dispatched).toHaveProperty("space");
    expect((dispatched as { task: { selected_space_id: string } }).task.selected_space_id).toBe(spaces[0].space_id);
    expect((dispatched as { task: { task_url: string | null } }).task.task_url).toBeNull();

    const pathDispatched = await postJson(`/api/spaces/${encodeURIComponent(spaces[0].space_id)}/tasks`, {
      description: "contract validator path Space dispatch",
      task_kind: "validation",
    });
    expect((pathDispatched as { task: { selected_space_id: string } }).task.selected_space_id).toBe(spaces[0].space_id);
    expect((pathDispatched as { task: { task_url: string | null } }).task.task_url).toBeNull();
  });
});
