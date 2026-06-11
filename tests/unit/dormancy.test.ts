import { afterEach, describe, expect, it, vi } from "vitest";
import { DormancyManager } from "../../src/dormancy.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DormancyManager", () => {
  it("does not treat an arbitrary extension service worker as the Comet bridge", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: "sw-1",
          type: "service_worker",
          url: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/background.js",
        },
      ],
    })));

    const manager = new DormancyManager(9222);

    await expect(manager.isExtensionAlive()).resolves.toBe(false);
    expect(manager.getExtensionId()).toBeNull();
  });
});
