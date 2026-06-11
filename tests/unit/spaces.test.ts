import { describe, expect, it } from "vitest";
import {
  findSpace,
  listSpaces,
  normalizeQuery,
  parseSpaceId,
  rankSpaces,
} from "../../src/spaces.js";
import type { TabInfo } from "../../src/types.js";

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

describe("Spaces inventory", () => {
  it("parses Space ids and query terms", () => {
    expect(parseSpaceId("https://www.perplexity.ai/spaces/dev-salt-platform-pull-request-utoxJDciQhmnWX2lOmCS6A")).toBe(
      "dev-salt-platform-pull-request-utoxJDciQhmnWX2lOmCS6A",
    );
    expect(normalizeQuery("GitHub pull request / Jira")).toEqual(["github", "pull", "request", "jira"]);
  });

  it("lists unique open Space tabs with inferred skill tags", () => {
    const spaces = listSpaces([
      tab({
        id: 11,
        title: "dev/salt-platform/pull-request - Perplexity",
        url: "https://www.perplexity.ai/spaces/dev-salt-platform-pull-request-utoxJDciQhmnWX2lOmCS6A",
      }),
      tab({
        id: 12,
        title: "Duplicate",
        url: "https://www.perplexity.ai/spaces/dev-salt-platform-pull-request-utoxJDciQhmnWX2lOmCS6A",
      }),
      tab({ title: "Computer", url: "https://www.perplexity.ai/computer/tasks" }),
    ]);

    expect(spaces).toHaveLength(1);
    expect(spaces[0].space_id).toBe("dev-salt-platform-pull-request-utoxJDciQhmnWX2lOmCS6A");
    expect(spaces[0].skills).toEqual(expect.arrayContaining(["pull-request", "salt-platform"]));
  });

  it("ranks Spaces by requested task terms", () => {
    const spaces = listSpaces([
      tab({
        title: "Meeting Notes Processing Research",
        url: "https://www.perplexity.ai/spaces/meeting-notes-research",
      }),
      tab({
        title: "GitHub Pull Request Skills Usage",
        url: "https://www.perplexity.ai/spaces/github-pull-request-skills",
      }),
    ]);

    const ranked = rankSpaces(spaces, "github pull request review");

    expect(ranked[0].space_id).toBe("github-pull-request-skills");
    expect(ranked[0].rank_score).toBeGreaterThan(ranked[1].rank_score);
    expect(ranked[0].selection_reason).toContain("github");
  });

  it("finds Spaces by id or URL", () => {
    const spaces = listSpaces([
      tab({
        title: "Jira Manager",
        url: "https://www.perplexity.ai/spaces/jira-manager-okr",
      }),
    ]);

    expect(findSpace(spaces, "jira-manager-okr")?.name).toBe("Jira Manager");
    expect(findSpace(spaces, "https://www.perplexity.ai/spaces/jira-manager-okr")?.space_id).toBe("jira-manager-okr");
  });
});
