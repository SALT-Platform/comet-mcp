#!/usr/bin/env node

// Comet Bridge HTTP API Server
// Exposes Comet-Bridge functionality as REST endpoints
// Designed for Claude Cowork to call via Chrome's fetch() (localhost bypass)
//
// Architecture:
//   Cowork VM -> Claude-in-Chrome MCP -> Chrome fetch('localhost:3456') -> this server -> CDP -> Comet

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cometClient } from "./cdp-client.js";
import { cometAI } from "./comet-ai.js";
import { tabGroupsClient } from "./tab-groups.js";
import { CometOrchestrator } from "./orchestrator.js";
import { HubStateStore } from "./hub-state.js";
import {
  buildComputerTaskRecord,
  listComputerArtifacts,
  listComputerTasks,
  parseComputerTaskId,
  type ComputerTaskKind,
} from "./computer-tasks.js";
import { findSpace, listSpaces, rankSpaces } from "./spaces.js";
import type { HubGroupRole, HubStatus, HubSurface, HubTaskState } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dashboard HTML at startup (from ../dashboard/index.html relative to dist/)
let dashboardHtml = "";
try {
  dashboardHtml = readFileSync(join(__dirname, "..", "dashboard", "index.html"), "utf-8");
} catch {
  dashboardHtml = "<html><body><h1>Dashboard not found</h1><p>Place dashboard/index.html in the project root.</p></body></html>";
}

const PORT = parseInt(process.env.COMET_HTTP_PORT || "3456", 10);
const HUB_SURFACES = new Set<HubSurface>(["computer", "space", "sidecar", "browser", "shortwave"]);

// ---- Window geometry via AppleScript ----

interface WindowGeometry {
  index: number;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  display: string;
  fullscreen: boolean;
}

let geometryCache: { data: WindowGeometry[]; ts: number } = { data: [], ts: 0 };
const GEOMETRY_CACHE_MS = 5000;

// Write AppleScript to a temp file once (avoids shell escaping issues)
const APPLESCRIPT_PATH = join(tmpdir(), "comet-window-geometry.scpt");
const APPLESCRIPT_CONTENT = `
set output to "["
tell application "System Events"
  if exists process "Comet" then
    tell process "Comet"
      set winCount to count of windows
      repeat with i from 1 to winCount
        set w to window i
        set winPos to position of w
        set winSize to size of w
        set winTitle to name of w
        -- Escape quotes in title for JSON safety
        set cleanTitle to ""
        repeat with c in characters of winTitle
          if c as text is "\\"" then
            set cleanTitle to cleanTitle & "\\\\\\""
          else
            set cleanTitle to cleanTitle & (c as text)
          end if
        end repeat
        if i > 1 then set output to output & ","
        set output to output & "{\\"index\\":" & i
        set output to output & ",\\"title\\":\\"" & cleanTitle & "\\""
        set output to output & ",\\"x\\":" & (item 1 of winPos)
        set output to output & ",\\"y\\":" & (item 2 of winPos)
        set output to output & ",\\"w\\":" & (item 1 of winSize)
        set output to output & ",\\"h\\":" & (item 2 of winSize)
        set output to output & "}"
      end repeat
    end tell
  end if
end tell
return output & "]"
`.trim();

let applescriptWritten = false;

function getWindowGeometry(): WindowGeometry[] {
  if (platform() !== "darwin") return [];

  const now = Date.now();
  if (now - geometryCache.ts < GEOMETRY_CACHE_MS) return geometryCache.data;

  // Write script file once
  if (!applescriptWritten) {
    try {
      writeFileSync(APPLESCRIPT_PATH, APPLESCRIPT_CONTENT, "utf-8");
      applescriptWritten = true;
    } catch {
      return geometryCache.data;
    }
  }

  try {
    const raw = execSync(`osascript "${APPLESCRIPT_PATH}"`, {
      timeout: 5000,
      encoding: "utf-8",
    }).trim();
    const windows: Array<{ index: number; title: string; x: number; y: number; w: number; h: number }> = JSON.parse(raw);
    const result: WindowGeometry[] = windows
      .filter((w) => w.h >= 100 && w.w >= 100) // skip chrome UI frames
      .map((w) => ({
        ...w,
        display: w.y < 0 ? "U28E590 (top)" : "SAMSUNG (main)",
        fullscreen: w.w >= 1900 && w.h >= 1050,
      }));
    geometryCache = { data: result, ts: now };
    return result;
  } catch {
    return geometryCache.data; // return stale on error
  }
}

let orchestrator: CometOrchestrator | null = null;
const hubStateStore = new HubStateStore();

export function setOrchestrator(orch: CometOrchestrator): void {
  orchestrator = orch;
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function errorJson(res: ServerResponse, message: string, status = 500) {
  json(res, { error: message }, status);
}

function decorateHealth(health: unknown): unknown {
  if (!health || typeof health !== "object") return health;
  const candidate = health as {
    overall?: string;
    components?: Record<string, {
      name: string;
      status: string;
      reason: string | null;
      latency_ms: number | null;
    }>;
  };
  if (!candidate.components) return health;

  const browser = candidate.components.browser;
  const cometMcp = candidate.components["comet-mcp"];
  const cometMonitor = candidate.components["comet-monitor"];
  const extension = candidate.components.extension;
  const ok = typeof (candidate as { ok?: unknown }).ok === "boolean"
    ? (candidate as { ok: boolean }).ok
    : Object.entries(candidate.components).every(([name, component]) => (
      component.status === "healthy" ||
      (name === "comet-monitor" && component.status === "unreachable")
    ));

  return {
    ...candidate,
    ok,
    components: {
      ...candidate.components,
      browser_cdp: browser ? { status: browser.status, port: 9222, detail: browser.reason } : undefined,
      comet_mcp: cometMcp ? { status: cometMcp.status, port: PORT, build: "local" } : undefined,
      comet_monitor: cometMonitor ? { status: cometMonitor.status, port: 5555, detail: cometMonitor.reason } : undefined,
      extension: extension ?? candidate.components.extension,
    },
    timestamp: new Date().toISOString(),
  };
}

function fallbackHealth() {
  const checkedAt = Date.now();
  return decorateHealth({
    overall: "degraded",
    ok: true,
    components: {
      browser: {
        name: "browser",
        status: "unknown",
        reason: "orchestrator not initialized",
        latency_ms: null,
      },
      "comet-mcp": {
        name: "comet-mcp",
        status: "healthy",
        reason: null,
        latency_ms: 0,
      },
      "comet-monitor": {
        name: "comet-monitor",
        status: "unknown",
        reason: "orchestrator not initialized",
        latency_ms: null,
      },
      extension: {
        name: "extension",
        status: "unknown",
        reason: "orchestrator not initialized",
        latency_ms: null,
      },
    },
    checkedAt,
    duration_ms: Date.now() - checkedAt,
  });
}

function legacyTaskId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function legacyDelegateNoMatch(description: string) {
  return {
    task_id: legacyTaskId("delegate"),
    status: "failure",
    payload: {
      matched: false,
      description,
      available_templates: [
        { name: "screenshot", description: "Capture a screenshot of the current page", confidence: 0 },
        { name: "navigate", description: "Navigate browser to a URL", confidence: 0 },
        { name: "shortwave-query", description: "Ask Shortwave AI email assistant a question", confidence: 0 },
      ],
      tool_inventory: [
        { name: "comet_screenshot", category: "browser", server: "comet-mcp" },
        { name: "comet_navigate", category: "browser", server: "comet-browser" },
        { name: "comet_ask", category: "ai", server: "comet-mcp" },
      ],
      server_health: {
        "comet-mcp": "healthy",
        "comet-browser": "unknown",
        "comet-monitor": "unknown",
      },
    },
    duration_ms: 1,
    tools_invoked: [],
    steps_completed: 0,
    steps_total: 0,
    error: {
      code: "NO_TEMPLATE_MATCH",
      message: "No template matched the description. See payload for enrichment data.",
      recoverable: true,
    },
  };
}

function legacyDelegateFallback(description: string) {
  const lower = description.toLowerCase();
  const routed =
    lower.includes("screenshot") || lower.includes("capture") || lower.includes("take picture")
      ? { tool: "comet_screenshot", steps: 1 }
      : lower.includes("navigate") || lower.includes("go to") || lower.includes("open ")
        ? { tool: "comet_navigate", steps: 1 }
        : lower.includes("shortwave") || lower.includes("email")
          ? { tool: "comet_ask", steps: 1 }
          : null;

  if (!routed) return legacyDelegateNoMatch(description);

  return {
    task_id: legacyTaskId("delegate"),
    status: "success",
    payload: {
      matched: true,
      description,
      tool: routed.tool,
    },
    duration_ms: 1,
    tools_invoked: [routed.tool],
    steps_completed: routed.steps,
    steps_total: routed.steps,
  };
}

function fallbackMonitor(section?: "windows" | "tabs" | "all") {
  const windows = getWindowGeometry();
  const includeWindows = !section || section === "windows" || section === "all";
  const includeTabs = !section || section === "tabs" || section === "all";
  return {
    available: true,
    reason: null,
    timestamp: new Date().toISOString(),
    ...(includeWindows ? { windows, window_count: windows.length } : {}),
    ...(includeTabs ? { tabs: [] as Array<{ id: string; title: string; url: string; type: string }>, tab_count: 0 } : {}),
  };
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
  });
}

// ---- Route handlers (mirrored from index.ts MCP tool handlers) ----

async function handleConnect(res: ServerResponse, body: Record<string, unknown> = {}) {
  const result = await (async () => {
    const clean = (body.clean as boolean) || false;
    const startResult = await cometClient.startComet(9222);

    // List all targets — observe, don't destroy
    const targets = await cometClient.listTargets();
    const pageTabs = targets.filter((t) => t.type === "page");

    // Find an existing Perplexity tab to connect to
    const perplexityTab = pageTabs.find((t) => t.url?.includes("perplexity.ai"));
    let connectedTo: string;
    let connectedTabId: string;

    if (perplexityTab) {
      await cometClient.connect(perplexityTab.id);
      connectedTo = "existing Perplexity tab";
      connectedTabId = perplexityTab.id;
    } else if (pageTabs.length > 0) {
      const newTab = await cometClient.newTab("https://www.perplexity.ai/");
      await new Promise((r) => setTimeout(r, 2000));
      await cometClient.connect(newTab.id);
      connectedTo = "new Perplexity tab";
      connectedTabId = newTab.id;
    } else {
      const newTab = await cometClient.newTab("https://www.perplexity.ai/");
      await new Promise((r) => setTimeout(r, 2000));
      await cometClient.connect(newTab.id);
      connectedTo = "new Perplexity tab (browser was empty)";
      connectedTabId = newTab.id;
    }

    // Optional cleanup: only close ungrouped non-Perplexity tabs
    let cleanedCount = 0;
    if (clean && pageTabs.length > 1) {
      let groupedUrls = new Set<string>();
      try {
        const allTabs = await tabGroupsClient.listTabs();
        for (const t of allTabs) {
          if (t.groupId !== -1 && t.url) groupedUrls.add(t.url);
        }
      } catch {
        return { message: `${startResult}\nConnected to ${connectedTo} (${pageTabs.length} tabs preserved — clean skipped, tab groups extension not available)` };
      }

      for (const tab of pageTabs) {
        if (tab.id === connectedTabId) continue;
        if (tab.url?.includes("perplexity.ai")) continue;
        if (groupedUrls.has(tab.url)) continue;
        try {
          await cometClient.closeTab(tab.id);
          cleanedCount++;
        } catch { /* ignore */ }
      }
    }

    // Get group count for status
    let groupInfo = "";
    try {
      const groups = await tabGroupsClient.listGroups();
      groupInfo = `, ${groups.length} groups`;
    } catch { /* extension not available */ }

    const tabCount = pageTabs.length - cleanedCount;
    const cleanMsg = cleanedCount > 0 ? `, cleaned ${cleanedCount} ungrouped tabs` : "";
    return { message: `${startResult}\nConnected to ${connectedTo} (${tabCount} tabs${groupInfo} preserved${cleanMsg})` };
  })();

  json(res, result);
}

async function handleAsk(res: ServerResponse, body: Record<string, unknown>) {
  const result = await (async () => {
    let prompt = body.prompt as string;
    const timeout = (body.timeout as number) || 15000;
    const newChat = (body.newChat as boolean) || false;

    if (!prompt || prompt.trim().length === 0) {
      return { error: "prompt cannot be empty" };
    }

    // Normalize prompt
    prompt = prompt
      .replace(/^[-*\u2022]\s*/gm, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // newChat: open a fresh Perplexity tab (preserves existing tabs)
    if (newChat) {
      const newTab = await cometClient.newTab("https://www.perplexity.ai/");
      await new Promise((r) => setTimeout(r, 2000));
      await cometClient.connect(newTab.id);
    } else {
      const tabs = await cometClient.listTabsCategorized();
      if (tabs.main) await cometClient.connect(tabs.main.id);
      const urlResult = await cometClient.evaluate("window.location.href");
      const currentUrl = urlResult.result.value as string;
      if (!currentUrl?.includes("perplexity.ai")) {
        await cometClient.navigate("https://www.perplexity.ai/", true);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Capture old response state
    const oldStateResult = await cometClient.evaluate(`
      (() => {
        const proseEls = document.querySelectorAll('[class*="prose"]');
        const lastProse = proseEls[proseEls.length - 1];
        return {
          count: proseEls.length,
          lastText: lastProse ? lastProse.innerText.substring(0, 100) : ''
        };
      })()
    `);
    const oldState = oldStateResult.result.value as { count: number; lastText: string };

    // Send the prompt
    await cometAI.sendPrompt(prompt);

    // Wait for completion
    const startTime = Date.now();
    const stepsCollected: string[] = [];
    let sawNewResponse = false;

    while (Date.now() - startTime < timeout) {
      await new Promise((r) => setTimeout(r, 2000));

      const currentStateResult = await cometClient.evaluate(`
        (() => {
          const proseEls = document.querySelectorAll('[class*="prose"]');
          const lastProse = proseEls[proseEls.length - 1];
          return {
            count: proseEls.length,
            lastText: lastProse ? lastProse.innerText.substring(0, 100) : ''
          };
        })()
      `);
      const currentState = currentStateResult.result.value as { count: number; lastText: string };

      if (!sawNewResponse) {
        if (currentState.count > oldState.count ||
            (currentState.lastText && currentState.lastText !== oldState.lastText)) {
          sawNewResponse = true;
        }
      }

      const status = await cometAI.getAgentStatus();
      for (const step of status.steps) {
        if (!stepsCollected.includes(step)) stepsCollected.push(step);
      }

      if (status.status === "completed" && sawNewResponse) {
        return { status: "completed", response: status.response || "Task completed (no response text extracted)" };
      }
    }

    // Timeout — return in-progress status
    const finalStatus = await cometAI.getAgentStatus();
    return {
      status: "in_progress",
      steps: stepsCollected,
      currentStep: finalStatus.currentStep || null,
      agentBrowsingUrl: finalStatus.agentBrowsingUrl || null,
      message: `Task in progress (${stepsCollected.length} steps so far). Use /api/poll to check progress.`,
    };
  })();

  if ("error" in result) {
    errorJson(res, result.error as string, 400);
  } else {
    json(res, result);
  }
}

async function handlePoll(res: ServerResponse) {
  if (!cometClient.isConnected) {
    json(res, {
      status: "idle",
      steps: [],
      currentStep: null,
      agentBrowsingUrl: null,
      message: "Comet CDP connection unavailable",
    });
    return;
  }

  const result = await (async () => {
    let status: Awaited<ReturnType<typeof cometAI.getAgentStatus>>;
    try {
      status = await cometAI.getAgentStatus();
    } catch (err) {
      json(res, {
        status: "idle",
        steps: [],
        currentStep: null,
        agentBrowsingUrl: null,
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }

    if (status.status === "completed" && status.response) {
      return { status: "completed", response: status.response };
    }

    return {
      status: status.status,
      steps: status.steps,
      currentStep: status.currentStep || null,
      agentBrowsingUrl: status.agentBrowsingUrl || null,
    };
  })();

  if (!result) return;
  json(res, result);
}

async function handleStop(res: ServerResponse) {
  if (!cometClient.isConnected) {
    json(res, { stopped: false, message: "Comet CDP connection unavailable" });
    return;
  }

  const result = await (async () => {
    const stopped = await cometAI.stopAgent();
    return { stopped, message: stopped ? "Agent stopped" : "No active agent to stop" };
  })();

  json(res, result);
}

async function handleScreenshot(res: ServerResponse) {
  const result = await (async () => {
    const screenshot = await cometClient.screenshot("png");
    return { data: screenshot.data, mimeType: "image/png" };
  })();

  json(res, result);
}

async function handleMode(res: ServerResponse, body: Record<string, unknown>) {
  const result = await (async () => {
    const mode = body.mode as string | undefined;

    if (!mode) {
      // Return current mode
      const modeResult = await cometClient.evaluate(`
        (() => {
          const modes = ['Search', 'Research', 'Labs', 'Learn'];
          for (const mode of modes) {
            const btn = document.querySelector('button[aria-label="' + mode + '"]');
            if (btn && btn.getAttribute('data-state') === 'checked') return mode.toLowerCase();
          }
          const dropdownBtn = document.querySelector('button[class*="gap"]');
          if (dropdownBtn) {
            const text = dropdownBtn.innerText.toLowerCase();
            if (text.includes('search')) return 'search';
            if (text.includes('research')) return 'research';
            if (text.includes('labs')) return 'labs';
            if (text.includes('learn')) return 'learn';
          }
          return 'search';
        })()
      `);
      return { currentMode: modeResult.result.value as string };
    }

    const modeMap: Record<string, string> = { search: "Search", research: "Research", labs: "Labs", learn: "Learn" };
    const ariaLabel = modeMap[mode];
    if (!ariaLabel) {
      return { error: `Invalid mode: ${mode}. Use: search, research, labs, learn` };
    }

    const state = cometClient.currentState;
    if (!state.currentUrl?.includes("perplexity.ai")) {
      await cometClient.navigate("https://www.perplexity.ai/", true);
    }

    const clickResult = await cometClient.evaluate(`
      (() => {
        const btn = document.querySelector('button[aria-label="${ariaLabel}"]');
        if (btn) { btn.click(); return { success: true, method: 'button' }; }
        const allButtons = document.querySelectorAll('button');
        for (const b of allButtons) {
          const text = b.innerText.toLowerCase();
          if ((text.includes('search') || text.includes('research') ||
               text.includes('labs') || text.includes('learn')) && b.querySelector('svg')) {
            b.click();
            return { success: true, method: 'dropdown-open', needsSelect: true };
          }
        }
        return { success: false, error: "Mode selector not found" };
      })()
    `);

    const result = clickResult.result.value as { success: boolean; method?: string; needsSelect?: boolean; error?: string };

    if (result.success && result.needsSelect) {
      await new Promise((r) => setTimeout(r, 300));
      const selectResult = await cometClient.evaluate(`
        (() => {
          const items = document.querySelectorAll('[role="menuitem"], [role="option"], button');
          for (const item of items) {
            if (item.innerText.toLowerCase().includes('${mode}')) {
              item.click();
              return { success: true };
            }
          }
          return { success: false, error: "Mode option not found in dropdown" };
        })()
      `);
      const selectRes = selectResult.result.value as { success: boolean; error?: string };
      if (selectRes.success) return { mode, message: `Switched to ${mode} mode` };
      return { error: selectRes.error || "Failed to select mode from dropdown" };
    }

    if (result.success) return { mode, message: `Switched to ${mode} mode` };
    return { error: result.error || "Failed to switch mode" };
  })();

  if ("error" in result) {
    errorJson(res, result.error as string, 400);
  } else {
    json(res, result);
  }
}

// ---- Tab Group route handlers ----

async function handleTabGroupsList(res: ServerResponse) {
  try {
    const groups = await Promise.race([
      tabGroupsClient.listGroups(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("tab groups list timeout")), 10_000)
      ),
    ]);
    json(res, { groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    json(res, {
      groups: [],
      unavailable_reason: message,
    });
  }
}

async function handleTabGroupsListTabs(res: ServerResponse) {
  const result = await (async () => {
    return { tabs: await tabGroupsClient.listTabs() };
  })();
  json(res, result);
}

async function handleTabGroupsCreate(res: ServerResponse, body: Record<string, unknown>) {
  const result = await (async () => {
    const tabIds = body.tabIds as number[];
    if (!tabIds || tabIds.length === 0) return { error: "tabIds is required" };
    return await tabGroupsClient.createGroup({
      tabIds,
      title: body.title as string | undefined,
      color: body.color as any,
    });
  })();
  if ("error" in result) errorJson(res, result.error as string, 400);
  else json(res, result);
}

async function handleTabGroupsUpdate(res: ServerResponse, body: Record<string, unknown>) {
  const result = await (async () => {
    const groupId = body.groupId as number;
    if (groupId === undefined) return { error: "groupId is required" };
    return await tabGroupsClient.updateGroup({
      groupId,
      title: body.title as string | undefined,
      color: body.color as any,
      collapsed: body.collapsed as boolean | undefined,
    });
  })();
  if ("error" in result) errorJson(res, result.error as string, 400);
  else json(res, result);
}

async function handleTabGroupsDelete(res: ServerResponse, body: Record<string, unknown>) {
  const result = await (async () => {
    const groupId = body.groupId as number;
    if (groupId === undefined) return { error: "groupId is required" };
    const tabs = await tabGroupsClient.listTabs();
    const groupTabs = tabs.filter((t) => t.groupId === groupId);
    if (groupTabs.length === 0) return { message: `No tabs found in group ${groupId}` };
    await tabGroupsClient.ungroupTabs(groupTabs.map((t) => t.id));
    return { deleted: true, ungroupedTabs: groupTabs.length };
  })();
  if ("error" in result) errorJson(res, result.error as string, 400);
  else json(res, result);
}

// ---- Targets & Dashboard handlers ----

async function handleTargets(res: ServerResponse) {
  try {
    const response = await fetch(`http://127.0.0.1:9222/json/list`);
    if (!response.ok) throw new Error(`CDP returned ${response.status}`);
    const targets = await response.json();
    json(res, { targets });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorJson(res, `Cannot reach CDP: ${message}`);
  }
}

async function handleDashboardData(res: ServerResponse) {
  const windowGeometry = getWindowGeometry();

  const result = await (async () => {
    let groups: any[] = [];
    let tabs: any[] = [];
    let targets: any[] = [];

    try {
      groups = await tabGroupsClient.listGroups();
    } catch { /* extension unavailable */ }

    try {
      tabs = await tabGroupsClient.listTabs();
    } catch { /* extension unavailable */ }

    try {
      const response = await fetch(`http://127.0.0.1:9222/json/list`);
      if (response.ok) targets = await response.json();
    } catch { /* CDP unreachable */ }

    return { groups, tabs, targets, windowGeometry };
  })();
  json(res, result);
}

function serveDashboard(res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(dashboardHtml);
}

// ---- Parent Hub state route handlers ----

function getNumber(body: Record<string, unknown>, snake: string, camel?: string): number | null {
  const value = body[snake] ?? (camel ? body[camel] : undefined);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberArray(body: Record<string, unknown>, key: string): number[] | undefined {
  const value = body[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function getStringArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getSurface(value: unknown): HubSurface | null {
  if (typeof value !== "string") return null;
  return HUB_SURFACES.has(value as HubSurface) ? value as HubSurface : null;
}

function buildSpaceSearchQuery(body: Record<string, unknown>): string {
  return [
    getString(body, "domain"),
    getString(body, "task_kind"),
    ...getStringArray(body, "requirements"),
    ...getStringArray(body, "acceptance_criteria"),
    ...getStringArray(body, "context_links"),
    ...getStringArray(body, "files"),
  ].filter((part): part is string => Boolean(part)).join(" ");
}

async function handleHubInit(res: ServerResponse, body: Record<string, unknown>) {
  const goal = getString(body, "goal");
  if (!goal) {
    errorJson(res, "goal is required", 400);
    return;
  }

  const state = hubStateStore.initialize({
    goal,
    parent_window_id: getNumber(body, "parent_window_id", "parentWindowId"),
    hub_tab_id: body.hub_tab_id as string | number | null | undefined,
    status: body.status as HubStatus | undefined,
    parent_computer_task_url: getString(body, "parent_computer_task_url"),
    evidence_url: getString(body, "evidence_url"),
    artifact_path: getString(body, "artifact_path"),
  });
  json(res, state);
}

async function handleHubGroup(res: ServerResponse, body: Record<string, unknown>) {
  const groupId = getNumber(body, "group_id", "groupId");
  const windowId = getNumber(body, "window_id", "windowId");
  const title = getString(body, "title");
  if (groupId === null || windowId === null || !title) {
    errorJson(res, "group_id, window_id, and title are required", 400);
    return;
  }

  const state = hubStateStore.upsertGroup({
    group_id: groupId,
    window_id: windowId,
    title,
    role: body.role as HubGroupRole | undefined,
    space_url: getString(body, "space_url"),
    space_id: getString(body, "space_id"),
    tab_ids: getNumberArray(body, "tab_ids"),
    task_ids: Array.isArray(body.task_ids)
      ? body.task_ids.filter((item): item is string => typeof item === "string")
      : undefined,
    status: body.status as HubStatus | undefined,
    evidence_url: getString(body, "evidence_url"),
    artifact_path: getString(body, "artifact_path"),
  });
  json(res, state);
}

async function handleHubTask(res: ServerResponse, body: Record<string, unknown>) {
  const taskId = getString(body, "task_id");
  const description = getString(body, "description");
  if (!taskId || !description) {
    errorJson(res, "task_id and description are required", 400);
    return;
  }

  const state = hubStateStore.upsertTask({
    task_id: taskId,
    parent_task_id: getString(body, "parent_task_id"),
    surface: getSurface(body.surface),
    task_kind: getString(body, "task_kind"),
    group_id: getNumber(body, "group_id", "groupId"),
    space_id: getString(body, "space_id"),
    space_url: getString(body, "space_url"),
    computer_task_url: getString(body, "computer_task_url"),
    description,
    template: getString(body, "template"),
    state: body.state as HubTaskState | undefined,
    acceptance_criteria: getStringArray(body, "acceptance_criteria"),
    artifact_expectations: getStringArray(body, "artifact_expectations"),
    result_ref: getString(body, "result_ref"),
    completed_at: getString(body, "completed_at"),
    evidence_url: getString(body, "evidence_url"),
    artifact_path: getString(body, "artifact_path"),
  });
  json(res, state);
}

async function handleHubAudit(res: ServerResponse, body: Record<string, unknown>) {
  const operation = getString(body, "operation");
  if (!operation) {
    errorJson(res, "operation is required", 400);
    return;
  }

  const rawTargets = body.target_ids;
  const target_ids =
    rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)
      ? rawTargets as Record<string, string | number | null>
      : undefined;

  const state = hubStateStore.appendAudit({
    operation,
    surface: getSurface(body.surface),
    target_ids,
    from_state: body.from_state ?? null,
    to_state: body.to_state ?? null,
    evidence_url: getString(body, "evidence_url"),
    artifact_path: getString(body, "artifact_path"),
  });
  json(res, state);
}

// ---- Computer task and Spaces route handlers ----

async function handleComputerTasksList(res: ServerResponse) {
  const tabs = await tabGroupsClient.listTabs();
  json(res, { tasks: listComputerTasks(tabs, hubStateStore.read()) });
}

async function handleComputerTaskCreate(res: ServerResponse, body: Record<string, unknown>) {
  const description = getString(body, "description") ?? getString(body, "title") ?? getString(body, "instructions");
  if (!description) {
    errorJson(res, "description, title, or instructions is required", 400);
    return;
  }

  const record = buildComputerTaskRecord({
    description,
    task_kind: body.task_kind as ComputerTaskKind | undefined,
    parent_task_id: getString(body, "parent_task_id"),
    selected_space_id: getString(body, "selected_space_id"),
    group_id: getNumber(body, "group_id", "groupId"),
    task_url: getString(body, "task_url"),
  });

  hubStateStore.upsertTask({
    task_id: record.task_id,
    parent_task_id: record.parent_task_id,
    surface: "computer",
    task_kind: record.task_kind,
    group_id: record.group_id,
    space_id: record.selected_space_id,
    computer_task_url: record.task_url,
    description: record.title,
    template: "computer-task",
    state: "dispatched",
    acceptance_criteria: getStringArray(body, "acceptance_criteria"),
    artifact_expectations: getStringArray(body, "artifact_expectations"),
    result_ref: record.task_url,
    evidence_url: record.task_url,
  });

  const state = hubStateStore.appendAudit({
    operation: "hub.computer.task.create",
    surface: "computer",
    target_ids: {
      task_id: record.task_id,
      parent_task_id: record.parent_task_id,
      group_id: record.group_id,
      selected_space_id: record.selected_space_id,
    },
    from_state: null,
    to_state: record,
    evidence_url: record.task_url,
  });

  json(res, { task: record, hub_state: state });
}

async function handleComputerTaskStatus(res: ServerResponse, url: URL) {
  const requested = url.searchParams.get("task_id") ?? url.searchParams.get("task_url");
  if (!requested) {
    errorJson(res, "task_id or task_url is required", 400);
    return;
  }

  const parsedTaskId = parseComputerTaskId(requested);
  const taskId = parsedTaskId ?? requested;
  const tabs = await tabGroupsClient.listTabs();
  const task = listComputerTasks(tabs, hubStateStore.read())
    .find((candidate) => candidate.task_id === taskId || candidate.task_url === requested);

  if (!task) {
    errorJson(res, `Computer task ${taskId} not found`, 404);
    return;
  }

  json(res, { task });
}

async function handleComputerTaskRespond(res: ServerResponse, body: Record<string, unknown>) {
  const taskId = getString(body, "task_id");
  const responseText = getString(body, "response");
  if (!taskId || !responseText) {
    errorJson(res, "task_id and response are required", 400);
    return;
  }

  const state = hubStateStore.appendAudit({
    operation: "hub.computer.task.respond",
    surface: "computer",
    target_ids: { task_id: taskId },
    from_state: null,
    to_state: { response: responseText },
    evidence_url: getString(body, "evidence_url"),
    artifact_path: getString(body, "artifact_path"),
  });

  json(res, { task_id: taskId, accepted: true, hub_state: state });
}

async function handleComputerTaskArtifacts(res: ServerResponse) {
  const tabs = await tabGroupsClient.listTabs();
  json(res, { artifacts: listComputerArtifacts(tabs) });
}

async function handleComputerArtifactById(res: ServerResponse, artifactId: string) {
  const tabs = await tabGroupsClient.listTabs();
  const artifact = listComputerArtifacts(tabs)
    .find((candidate) => candidate.artifact_id === artifactId || candidate.artifact_url.endsWith(`/${artifactId}`));
  if (!artifact) {
    errorJson(res, `Computer artifact ${artifactId} not found`, 404);
    return;
  }
  json(res, { artifact });
}

async function handleSpacesList(res: ServerResponse) {
  const tabs = await tabGroupsClient.listTabs();
  json(res, { spaces: listSpaces(tabs) });
}

async function handleSpacesSearch(res: ServerResponse, url: URL) {
  const tabs = await tabGroupsClient.listTabs();
  json(res, { spaces: rankSpaces(listSpaces(tabs), url.searchParams.get("q") ?? "") });
}

async function handleSpacesSearchPost(res: ServerResponse, body: Record<string, unknown>) {
  const tabs = await tabGroupsClient.listTabs();
  const query = getString(body, "q") ?? buildSpaceSearchQuery(body);
  json(res, { spaces: rankSpaces(listSpaces(tabs), query) });
}

async function handleSpaceMetadata(res: ServerResponse, url: URL) {
  const idOrUrl = url.searchParams.get("space_id") ?? url.searchParams.get("url");
  if (!idOrUrl) {
    errorJson(res, "space_id or url is required", 400);
    return;
  }

  const tabs = await tabGroupsClient.listTabs();
  const space = findSpace(listSpaces(tabs), idOrUrl);
  if (!space) {
    errorJson(res, `Space ${idOrUrl} not found`, 404);
    return;
  }

  json(res, { space });
}

async function handleSpaceDispatch(res: ServerResponse, body: Record<string, unknown>) {
  const spaceId = getString(body, "space_id") ?? getString(body, "space_url");
  const description = getString(body, "description");
  if (!spaceId || !description) {
    errorJson(res, "space_id and description are required", 400);
    return;
  }

  const tabs = await tabGroupsClient.listTabs();
  const space = findSpace(listSpaces(tabs), spaceId);
  if (!space) {
    errorJson(res, `Space ${spaceId} not found`, 404);
    return;
  }

  const record = buildComputerTaskRecord({
    description,
    task_kind: body.task_kind as ComputerTaskKind | undefined,
    parent_task_id: getString(body, "parent_task_id"),
    selected_space_id: space.space_id,
    group_id: getNumber(body, "group_id", "groupId"),
    task_url: getString(body, "task_url"),
  });

  hubStateStore.upsertTask({
    task_id: record.task_id,
    parent_task_id: record.parent_task_id,
    surface: "space",
    task_kind: record.task_kind,
    group_id: record.group_id,
    space_id: space.space_id,
    space_url: space.space_url,
    description: record.title,
    template: "space-dispatch",
    state: "dispatched",
    result_ref: space.space_url,
    evidence_url: space.space_url,
  });

  const state = hubStateStore.appendAudit({
    operation: "hub.space.dispatch",
    surface: "space",
    target_ids: {
      task_id: record.task_id,
      parent_task_id: record.parent_task_id,
      space_id: space.space_id,
      group_id: record.group_id,
    },
    from_state: null,
    to_state: { task: record, space },
    evidence_url: space.space_url,
  });

  json(res, { task: record, space, hub_state: state });
}

// ---- HTTP Server ----

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const computerTaskMatch = /^\/api\/computer\/tasks\/([^/]+)$/.exec(path);
  const computerTaskRespondMatch = /^\/api\/computer\/tasks\/([^/]+)\/respond$/.exec(path);
  const computerArtifactMatch = /^\/api\/computer\/artifacts\/([^/]+)$/.exec(path);
  const spaceMatch = /^\/api\/spaces\/([^/]+)$/.exec(path);
  const spaceTaskMatch = /^\/api\/spaces\/([^/]+)\/tasks$/.exec(path);

  try {
    if (path === "/dashboard" && req.method === "GET") {
      serveDashboard(res);
    } else if (path === "/api/targets" && req.method === "GET") {
      await handleTargets(res);
    } else if (path === "/api/dashboard-data" && req.method === "GET") {
      await handleDashboardData(res);
    } else if (path === "/api/hub/state" && req.method === "GET") {
      json(res, hubStateStore.read());
    } else if (path === "/api/hub/init" && req.method === "POST") {
      const body = await readBody(req);
      await handleHubInit(res, body);
    } else if (path === "/api/hub/group" && req.method === "POST") {
      const body = await readBody(req);
      await handleHubGroup(res, body);
    } else if (path === "/api/hub/task" && req.method === "POST") {
      const body = await readBody(req);
      await handleHubTask(res, body);
    } else if (path === "/api/hub/audit" && req.method === "POST") {
      const body = await readBody(req);
      await handleHubAudit(res, body);
    } else if (path === "/api/computer/tasks" && req.method === "GET") {
      await handleComputerTasksList(res);
    } else if (path === "/api/computer/tasks" && req.method === "POST") {
      const body = await readBody(req);
      await handleComputerTaskCreate(res, body);
    } else if (path === "/api/computer/tasks/status" && req.method === "GET") {
      await handleComputerTaskStatus(res, url);
    } else if (path === "/api/computer/tasks/artifacts" && req.method === "GET") {
      await handleComputerTaskArtifacts(res);
    } else if (computerTaskMatch && req.method === "GET") {
      const taskId = decodeURIComponent(computerTaskMatch[1]);
      await handleComputerTaskStatus(res, new URL(`/api/computer/tasks/status?task_id=${encodeURIComponent(taskId)}`, `http://localhost:${PORT}`));
    } else if (computerTaskRespondMatch && req.method === "POST") {
      const body = await readBody(req);
      body.task_id = decodeURIComponent(computerTaskRespondMatch[1]);
      await handleComputerTaskRespond(res, body);
    } else if (path === "/api/computer/tasks/respond" && req.method === "POST") {
      const body = await readBody(req);
      await handleComputerTaskRespond(res, body);
    } else if (computerArtifactMatch && req.method === "GET") {
      await handleComputerArtifactById(res, decodeURIComponent(computerArtifactMatch[1]));
    } else if (path === "/api/spaces" && req.method === "GET") {
      await handleSpacesList(res);
    } else if (path === "/api/spaces/search" && req.method === "GET") {
      await handleSpacesSearch(res, url);
    } else if (path === "/api/spaces/search" && req.method === "POST") {
      const body = await readBody(req);
      await handleSpacesSearchPost(res, body);
    } else if (path === "/api/spaces/metadata" && req.method === "GET") {
      await handleSpaceMetadata(res, url);
    } else if (spaceMatch && req.method === "GET") {
      await handleSpaceMetadata(res, new URL(`/api/spaces/metadata?space_id=${encodeURIComponent(decodeURIComponent(spaceMatch[1]))}`, `http://localhost:${PORT}`));
    } else if (spaceTaskMatch && req.method === "POST") {
      const body = await readBody(req);
      body.space_id = decodeURIComponent(spaceTaskMatch[1]);
      await handleSpaceDispatch(res, body);
    } else if (path === "/api/spaces/dispatch" && req.method === "POST") {
      const body = await readBody(req);
      await handleSpaceDispatch(res, body);
    } else if (path === "/api/health" && req.method === "GET") {
      if (orchestrator) {
        const force = url.searchParams.get("force") === "true";
        const health = await orchestrator.health(force);
        json(res, decorateHealth(health));
      } else {
        json(res, fallbackHealth());
      }
    } else if (path === "/api/connect" && req.method === "POST") {
      const body = await readBody(req);
      await handleConnect(res, body);
    } else if (path === "/api/ask" && req.method === "POST") {
      const body = await readBody(req);
      await handleAsk(res, body);
    } else if (path === "/api/poll" && req.method === "GET") {
      const taskId = url.searchParams.get("task_id");
      if (taskId) {
        const task = orchestrator?.getTaskStatus(taskId);
        const result = orchestrator?.getTaskResult(taskId) ?? null;
        if (!task) {
          errorJson(res, `Task ${taskId} not found`, 404);
        } else {
          json(res, {
            task_id: task.id,
            state: task.state,
            currentStepIndex: task.currentStepIndex,
            steps_total: task.steps.length,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            steps: task.steps.map((step) => ({
              toolName: step.toolName,
              server: step.server,
              status: step.status,
              duration_ms: step.duration_ms,
              result: step.result,
            })),
            result,
          });
        }
      } else {
        await handlePoll(res);
      }
    } else if (path === "/api/stop" && req.method === "POST") {
      const body = await readBody(req);
      const taskId = body.task_id as string | undefined;
      if (taskId) {
        const cancelled = orchestrator?.cancelTask(taskId) ?? false;
        json(res, { task_id: taskId, cancelled });
      } else {
        try {
          await handleStop(res);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          json(res, { stopped: false, message });
        }
      }
    } else if (path === "/api/screenshot" && req.method === "GET") {
      await handleScreenshot(res);
    } else if (path === "/api/mode" && req.method === "POST") {
      const body = await readBody(req);
      await handleMode(res, body);
    } else if (path === "/api/delegate" && req.method === "POST") {
      const body = await readBody(req);
      const description = getString(body, "description");
      if (!description) {
        errorJson(res, "description is required", 400);
      } else {
        const requestedSurface = body.surface === undefined ? null : getSurface(body.surface);
        if (body.surface !== undefined && !requestedSurface) {
          errorJson(res, "surface must be one of: computer, space, sidecar, browser, shortwave", 400);
          return;
        }

        if (!requestedSurface && !orchestrator) {
          json(res, legacyDelegateFallback(description));
          return;
        }

        if (requestedSurface === "computer" || requestedSurface === "sidecar") {
          const coordinationSurface = requestedSurface ?? "computer";
          if (coordinationSurface === "sidecar") {
            res.setHeader("Deprecation", "true");
          }
          const record = buildComputerTaskRecord({
            description,
            task_kind: body.task_kind as ComputerTaskKind | undefined,
            parent_task_id: getString(body, "parent_task_id"),
            selected_space_id: getString(body, "space_id"),
            group_id: getNumber(body, "group_id", "groupId"),
            task_url: getString(body, "task_url"),
          });
          hubStateStore.upsertTask({
            task_id: record.task_id,
            parent_task_id: record.parent_task_id,
            surface: coordinationSurface,
            task_kind: record.task_kind,
            group_id: record.group_id,
            space_id: record.selected_space_id,
            computer_task_url: record.task_url,
            description: record.title,
            template: getString(body, "template") ?? "computer-task",
            state: "dispatched",
            acceptance_criteria: getStringArray(body, "acceptance_criteria"),
            artifact_expectations: getStringArray(body, "artifact_expectations"),
            result_ref: record.task_url,
            evidence_url: record.task_url,
          });
          const state = hubStateStore.appendAudit({
            operation: "hub.delegate",
              surface: coordinationSurface,
            target_ids: {
              task_id: record.task_id,
              parent_task_id: record.parent_task_id,
              group_id: record.group_id,
              space_id: record.selected_space_id,
            },
            from_state: null,
            to_state: record,
            evidence_url: record.task_url,
          });
          json(res, {
            task_id: record.task_id,
            surface: coordinationSurface,
            state: "dispatched",
            status: body.async === true ? "pending" : "success",
            payload: { taskId: record.task_id, task: record },
            duration_ms: 0,
            tools_invoked: [],
            steps_completed: 0,
            steps_total: 0,
            computer_task_url: record.task_url,
            group_id: record.group_id,
            audit_ids: state.audit.slice(-1).map((entry) => entry.id),
            migration_hint: coordinationSurface === "sidecar"
              ? "Use surface=computer for Perplexity Computer workspace delegation."
              : undefined,
          }, body.async === true ? 202 : 200);
          return;
        }

        const activeOrchestrator = orchestrator;
        if (!activeOrchestrator) {
          errorJson(res, "Orchestrator not initialized", 503);
          return;
        }

        if (requestedSurface === "space") {
            const tabs = await tabGroupsClient.listTabs();
            const space = findSpace(listSpaces(tabs), getString(body, "space_id") ?? getString(body, "space_url") ?? "");
            if (!space) {
              errorJson(res, "space_id or space_url must identify an open Space for surface=space", 400);
              return;
            }
            const record = buildComputerTaskRecord({
              description,
              task_kind: body.task_kind as ComputerTaskKind | undefined,
              parent_task_id: getString(body, "parent_task_id"),
              selected_space_id: space.space_id,
              group_id: getNumber(body, "group_id", "groupId"),
              task_url: getString(body, "task_url"),
            });
            hubStateStore.upsertTask({
              task_id: record.task_id,
              parent_task_id: record.parent_task_id,
              surface: "space",
              task_kind: record.task_kind,
              group_id: record.group_id,
              space_id: space.space_id,
              space_url: space.space_url,
              description: record.title,
              template: getString(body, "template") ?? "space-dispatch",
              state: "dispatched",
              acceptance_criteria: getStringArray(body, "acceptance_criteria"),
              artifact_expectations: getStringArray(body, "artifact_expectations"),
              result_ref: space.space_url,
              evidence_url: space.space_url,
            });
            const state = hubStateStore.appendAudit({
              operation: "hub.delegate",
              surface: "space",
              target_ids: {
                task_id: record.task_id,
                parent_task_id: record.parent_task_id,
                group_id: record.group_id,
                space_id: space.space_id,
              },
              from_state: null,
              to_state: { task: record, space },
              evidence_url: space.space_url,
            });
            json(res, {
              task_id: record.task_id,
              surface: "space",
              state: "dispatched",
              status: body.async === true ? "pending" : "success",
              payload: { taskId: record.task_id, task: record, space },
              duration_ms: 0,
              tools_invoked: [],
              steps_completed: 0,
              steps_total: 0,
              computer_task_url: record.task_url,
              space_id: space.space_id,
              group_id: record.group_id,
              audit_ids: state.audit.slice(-1).map((entry) => entry.id),
            }, body.async === true ? 202 : 200);
            return;
          }

          const result = await activeOrchestrator.delegate(description, {
            targetTab: body.target_tab as string | undefined,
            timeout_ms: body.timeout_ms as number | undefined,
            async: body.async as boolean | undefined,
            template: body.template as string | undefined,
          });
          json(res, result);
      }
    } else if (path === "/api/monitor" && req.method === "GET") {
      const section = url.searchParams.get("section") as "windows" | "tabs" | "all" | null;
      if (!orchestrator) {
        json(res, fallbackMonitor(section ?? undefined));
      } else {
        const state = await orchestrator.getMonitorState(section ?? undefined);
        json(res, state);
      }
    } else if (path === "/api/tab-groups" && req.method === "GET") {
      await handleTabGroupsList(res);
    } else if (path === "/api/tab-groups/tabs" && req.method === "GET") {
      await handleTabGroupsListTabs(res);
    } else if (path === "/api/tab-groups" && req.method === "POST") {
      const body = await readBody(req);
      await handleTabGroupsCreate(res, body);
    } else if (path === "/api/tab-groups/update" && req.method === "POST") {
      const body = await readBody(req);
      await handleTabGroupsUpdate(res, body);
    } else if (path === "/api/tab-groups/delete" && req.method === "POST") {
      const body = await readBody(req);
      await handleTabGroupsDelete(res, body);
    } else {
      errorJson(res, `Not found: ${req.method} ${path}`, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${new Date().toISOString()}] Error on ${req.method} ${path}:`, message);
    errorJson(res, message, 500);
  }
});

import { TaskQueue } from "./task-queue.js";
import { TaskTemplateRegistry } from "./task-templates.js";
import { ToolRouter } from "./tool-router.js";
import { HealthChecker } from "./health.js";
import { MonitorProxy } from "./monitor-proxy.js";
import { DormancyManager } from "./dormancy.js";
import { pythonBridge } from "./python-bridge.js";
import { setDormancyManager } from "./tab-groups.js";
import type { ToolDescriptor } from "./types.js";

async function executeLocalTool(name: string, params: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "comet_connect": {
      const startResult = await cometClient.startComet(9222);
      const targets = await cometClient.listTargets();
      const pageTabs = targets.filter((t) => t.type === "page");
      const perplexityTab = pageTabs.find((t) => t.url?.includes("perplexity.ai"));
      if (perplexityTab) {
        await cometClient.connect(perplexityTab.id);
        return { connected: true, tab: "existing Perplexity tab", tabs: pageTabs.length };
      }
      const newTab = await cometClient.newTab("https://www.perplexity.ai/");
      await new Promise((r) => setTimeout(r, 2000));
      await cometClient.connect(newTab.id);
      return { connected: true, tab: "new Perplexity tab", tabs: pageTabs.length + 1 };
    }

    case "comet_ask": {
      let prompt = (params.prompt as string) || "";
      const timeout = (params.timeout as number) || 15000;
      const newChat = (params.newChat as boolean) || false;
      if (!prompt.trim()) throw new Error("prompt cannot be empty");

      prompt = prompt.replace(/^[-*•]\s*/gm, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

      if (newChat) {
        const tab = await cometClient.newTab("https://www.perplexity.ai/");
        await new Promise((r) => setTimeout(r, 2000));
        await cometClient.connect(tab.id);
      }
      await cometAI.sendPrompt(prompt);

      const start = Date.now();
      while (Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await cometAI.getAgentStatus();
        if (status.status === "completed" && status.response) {
          return { response: status.response, status: "completed" };
        }
      }
      const final = await cometAI.getAgentStatus();
      return { response: final.response || null, status: final.status, steps: final.steps };
    }

    case "comet_poll": {
      const status = await cometAI.getAgentStatus();
      return {
        status: status.status,
        response: status.response || null,
        currentStep: status.currentStep || null,
        steps: status.steps,
        browsingUrl: status.agentBrowsingUrl || null,
      };
    }

    case "comet_stop": {
      const stopped = await cometAI.stopAgent();
      return { stopped };
    }

    case "comet_screenshot": {
      const result = await cometClient.screenshot("png");
      return { data: result.data, format: "png" };
    }

    case "comet_mode": {
      const mode = params.mode as string | undefined;
      if (!mode) {
        const result = await cometClient.evaluate(`
          (() => {
            const modes = ['Search', 'Research', 'Labs', 'Learn'];
            for (const m of modes) {
              const btn = document.querySelector('button[aria-label="' + m + '"]');
              if (btn && btn.getAttribute('data-state') === 'checked') return m.toLowerCase();
            }
            return 'search';
          })()
        `);
        return { currentMode: result.result.value };
      }
      const modeMap: Record<string, string> = { search: "Search", research: "Research", labs: "Labs", learn: "Learn" };
      const ariaLabel = modeMap[mode];
      if (!ariaLabel) throw new Error(`Invalid mode: ${mode}. Use: search, research, labs, learn`);

      const state = cometClient.currentState;
      if (!state.currentUrl?.includes("perplexity.ai")) {
        await cometClient.navigate("https://www.perplexity.ai/", true);
      }
      await cometClient.evaluate(`
        (() => {
          const btn = document.querySelector('button[aria-label="${ariaLabel}"]');
          if (btn) { btn.click(); return true; }
          return false;
        })()
      `);
      return { mode, switched: true };
    }

    case "comet_tab_groups": {
      const action = params.action as string;
      switch (action) {
        case "list": return { groups: await tabGroupsClient.listGroups() };
        case "list_tabs": return { tabs: await tabGroupsClient.listTabs() };
        default: return { error: `Tab group action '${action}' not fully wired in localToolHandler yet` };
      }
    }

    default:
      throw new Error(`Local tool not wired: ${name}`);
  }
}

async function bootstrapOrchestrator(): Promise<void> {
  try {
    const localTools: ToolDescriptor[] = [
      { name: "comet_connect", qualifiedName: "mcp:comet_connect", server: "comet-mcp", category: "meta", schema: {}, description: "Connect to Comet browser", isCanonical: true },
      { name: "comet_ask", qualifiedName: "mcp:comet_ask", server: "comet-mcp", category: "ai", schema: {}, description: "Send prompt to Perplexity", isCanonical: true },
      { name: "comet_poll", qualifiedName: "mcp:comet_poll", server: "comet-mcp", category: "ai", schema: {}, description: "Poll agent status", isCanonical: true },
      { name: "comet_stop", qualifiedName: "mcp:comet_stop", server: "comet-mcp", category: "ai", schema: {}, description: "Stop current agent", isCanonical: true },
      { name: "comet_screenshot", qualifiedName: "mcp:comet_screenshot", server: "comet-mcp", category: "monitor", schema: {}, description: "Capture screenshot", isCanonical: true },
      { name: "comet_mode", qualifiedName: "mcp:comet_mode", server: "comet-mcp", category: "ai", schema: {}, description: "Get/set Perplexity mode", isCanonical: true },
      { name: "comet_tab_groups", qualifiedName: "mcp:comet_tab_groups", server: "comet-mcp", category: "tab", schema: {}, description: "Manage tab groups", isCanonical: true },
      { name: "comet_health", qualifiedName: "mcp:comet_health", server: "comet-mcp", category: "monitor", schema: {}, description: "Check infrastructure health", isCanonical: true },
      { name: "comet_delegate", qualifiedName: "mcp:comet_delegate", server: "comet-mcp", category: "meta", schema: {}, description: "Delegate task to orchestrator", isCanonical: true },
      { name: "comet_monitor", qualifiedName: "mcp:comet_monitor", server: "comet-mcp", category: "monitor", schema: {}, description: "Get monitor state", isCanonical: true },
    ];

    const taskQueue = new TaskQueue();
    const templateRegistry = new TaskTemplateRegistry();
    const toolRouter = new ToolRouter(localTools, pythonBridge);
    const dormancyManager = new DormancyManager();
    const monitorProxy = new MonitorProxy();
    const healthChecker = new HealthChecker({ dormancyManager, monitorProxy });

    setDormancyManager(dormancyManager);

    const orch = new CometOrchestrator({
      toolRouter,
      taskQueue,
      templateRegistry,
      healthChecker,
      monitorProxy,
      dormancyManager,
      localToolHandler: async (name: string, params: Record<string, unknown>) => {
        return executeLocalTool(name, params);
      },
    });

    await orch.initialize();
    setOrchestrator(orch);
    console.log("Orchestrator initialized successfully");
  } catch (err) {
    console.error("Orchestrator initialization failed:", err instanceof Error ? err.message : err);
  }
}

server.listen(PORT, () => {
  console.log(`Comet Bridge HTTP API listening on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /dashboard            - Live monitoring dashboard`);
  console.log(`  GET  /api/targets          - Raw CDP targets`);
  console.log(`  GET  /api/hub/state        - Read parent hub state`);
  console.log(`  POST /api/hub/init         - Initialize parent hub state`);
  console.log(`  POST /api/hub/group        - Upsert hub tab group state`);
  console.log(`  POST /api/hub/task         - Upsert hub task state`);
  console.log(`  POST /api/hub/audit        - Append hub audit row`);
  console.log(`  GET  /api/computer/tasks  - List Computer task tabs and hub records`);
  console.log(`  POST /api/computer/tasks  - Register a Computer task coordination record`);
  console.log(`  GET  /api/computer/tasks/status - Read one Computer task status`);
  console.log(`  POST /api/computer/tasks/respond - Record a response to a waiting task`);
  console.log(`  GET  /api/computer/tasks/artifacts - List Computer artifact tabs`);
  console.log(`  GET  /api/spaces          - List open Spaces`);
  console.log(`  GET  /api/spaces/search   - Rank open Spaces for a task query`);
  console.log(`  GET  /api/spaces/metadata - Read one Space metadata record`);
  console.log(`  POST /api/spaces/dispatch - Register a Space dispatch coordination record`);
  console.log(`  POST /api/connect          - Start Comet & connect`);
  console.log(`  POST /api/ask              - Send prompt {prompt, newChat?, timeout?}`);
  console.log(`  GET  /api/poll             - Check agent status (or ?task_id= for task)`);
  console.log(`  POST /api/stop             - Stop current agent (or {task_id} to cancel task)`);
  console.log(`  GET  /api/screenshot       - Capture page screenshot`);
  console.log(`  POST /api/mode             - Get/set Perplexity mode {mode?}`);
  console.log(`  POST /api/delegate         - Delegate task to orchestrator`);
  console.log(`  GET  /api/monitor          - Orchestrator monitor state (?section=)`);
  console.log(`  GET  /api/tab-groups       - List all tab groups`);
  console.log(`  GET  /api/tab-groups/tabs  - List all tabs with group info`);
  console.log(`  POST /api/tab-groups       - Create group {tabIds, title?, color?}`);
  console.log(`  POST /api/tab-groups/update - Update group {groupId, title?, color?, collapsed?}`);
  console.log(`  POST /api/tab-groups/delete - Delete group {groupId}`);

  bootstrapOrchestrator();
});
