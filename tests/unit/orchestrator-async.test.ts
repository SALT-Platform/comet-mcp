import { describe, expect, it } from "vitest";
import { CometOrchestrator } from "../../src/orchestrator.js";
import { TaskQueue } from "../../src/task-queue.js";
import { TaskTemplateRegistry } from "../../src/task-templates.js";
import type { HealthCheckResult, MonitorState, TaskResult, ToolDescriptor } from "../../src/types.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForResult(
  orchestrator: CometOrchestrator,
  taskId: string,
): Promise<TaskResult> {
  for (let i = 0; i < 50; i++) {
    const result = orchestrator.getTaskResult(taskId);
    if (result) return result;
    await delay(10);
  }
  throw new Error(`Timed out waiting for task result ${taskId}`);
}

function buildOrchestrator(calls: string[]): CometOrchestrator {
  const registry = new TaskTemplateRegistry({ skipBuiltins: true });
  registry.register({
    name: "unit-async",
    description: "Unit async template",
    triggerPatterns: ["unit async"],
    defaultParams: {},
    steps: [
      {
        toolName: "unit_step",
        server: "comet-mcp",
        paramTemplate: {},
        description: "Run unit step",
      },
    ],
  });

  const health: HealthCheckResult = {
    overall: "healthy",
    components: {},
    checkedAt: Date.now(),
    duration_ms: 1,
  };

  const monitor: MonitorState = { available: false, reason: "unit test" };

  return new CometOrchestrator({
    toolRouter: {
      initialize: async () => undefined,
      getInventory: (): ToolDescriptor[] => [],
      invoke: async () => ({ success: true, data: null, toolName: "noop", server: "comet-mcp", duration_ms: 0 }),
    } as any,
    taskQueue: new TaskQueue(),
    templateRegistry: registry,
    healthChecker: {
      check: async () => health,
      getCached: () => health,
    } as any,
    monitorProxy: {
      getState: async () => monitor,
    } as any,
    dormancyManager: {
      isExtensionAlive: async () => true,
      wake: async () => ({ success: true, technique: "none", attempts: 0, duration_ms: 0 }),
    } as any,
    localToolHandler: async (name: string) => {
      calls.push(name);
      await delay(5);
      return { ok: true, name };
    },
  });
}

describe("CometOrchestrator async delegation", () => {
  it("starts an async delegated task and stores its result for polling", async () => {
    const calls: string[] = [];
    const orchestrator = buildOrchestrator(calls);
    await orchestrator.initialize();

    const pending = await orchestrator.delegate("unit async", {
      async: true,
      template: "unit-async",
    });

    expect(pending.status).toBe("pending");
    const taskId = (pending.payload as { taskId: string }).taskId;
    const result = await waitForResult(orchestrator, taskId);

    expect(result.status).toBe("success");
    expect(result.steps_completed).toBe(1);
    expect(orchestrator.getTaskStatus(taskId)?.state).toBe("completed");
    expect(calls).toEqual(["unit_step"]);
  });

  it("runs same-target async work in FIFO order", async () => {
    const calls: string[] = [];
    const orchestrator = buildOrchestrator(calls);
    await orchestrator.initialize();

    const first = await orchestrator.delegate("unit async", {
      async: true,
      template: "unit-async",
      targetTab: "tab-a",
    });
    const second = await orchestrator.delegate("unit async", {
      async: true,
      template: "unit-async",
      targetTab: "tab-a",
    });

    const firstId = (first.payload as { taskId: string }).taskId;
    const secondId = (second.payload as { taskId: string }).taskId;

    await waitForResult(orchestrator, firstId);
    await waitForResult(orchestrator, secondId);

    expect(orchestrator.getTaskStatus(firstId)?.completedAt).toBeLessThanOrEqual(
      orchestrator.getTaskStatus(secondId)?.completedAt ?? 0,
    );
    expect(calls).toEqual(["unit_step", "unit_step"]);
  });
});
