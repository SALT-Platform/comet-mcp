import type { TabInfo } from "./types.js";

export interface SpaceCandidate {
  space_id: string;
  space_url: string;
  name: string;
  instructions_summary: string | null;
  skills: string[];
  files: string[];
  links: string[];
  prior_outputs: string[];
  rank_score: number;
  selection_reason: string;
  tab_id: number | null;
  window_id: number | null;
}

const SPACE_RE = /\/spaces\/([^/?#]+)/;

export function isSpaceUrl(url: string | null | undefined): boolean {
  return Boolean(url && SPACE_RE.test(url));
}

export function parseSpaceId(url: string | null | undefined): string | null {
  if (!url) return null;
  return SPACE_RE.exec(url)?.[1] ?? null;
}

export function normalizeQuery(query: string | null | undefined): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
}

export function listSpaces(
  tabs: Pick<TabInfo, "id" | "windowId" | "title" | "url">[],
): SpaceCandidate[] {
  const spaces = new Map<string, SpaceCandidate>();
  for (const tab of tabs) {
    const spaceId = parseSpaceId(tab.url);
    if (!spaceId) continue;
    if (spaces.has(spaceId)) continue;
    spaces.set(spaceId, {
      space_id: spaceId,
      space_url: tab.url,
      name: cleanSpaceName(tab.title, spaceId),
      instructions_summary: null,
      skills: inferSkillTags(`${tab.title} ${tab.url}`),
      files: [],
      links: [tab.url],
      prior_outputs: [],
      rank_score: 0,
      selection_reason: "Open Comet Space tab",
      tab_id: tab.id,
      window_id: tab.windowId,
    });
  }
  return [...spaces.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function rankSpaces(spaces: SpaceCandidate[], query: string): SpaceCandidate[] {
  const terms = normalizeQuery(query);
  return spaces
    .map((space) => {
      const haystack = `${space.name} ${space.space_url} ${space.skills.join(" ")}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term));
      const score = terms.length === 0 ? 0 : hits.length / terms.length;
      return {
        ...space,
        rank_score: score,
        selection_reason: hits.length > 0
          ? `Matched ${hits.join(", ")}`
          : "No query terms matched this Space",
      };
    })
    .sort((a, b) => b.rank_score - a.rank_score || a.name.localeCompare(b.name));
}

export function findSpace(spaces: SpaceCandidate[], spaceIdOrUrl: string): SpaceCandidate | null {
  const parsed = parseSpaceId(spaceIdOrUrl);
  const id = parsed ?? spaceIdOrUrl;
  return spaces.find((space) => space.space_id === id || space.space_url === spaceIdOrUrl) ?? null;
}

function cleanSpaceName(title: string, fallback: string): string {
  const cleaned = title
    .replace(/\s+-\s+Perplexity$/i, "")
    .replace(/\s+\|\s+Perplexity$/i, "")
    .trim();
  return cleaned || fallback;
}

function inferSkillTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();
  if (lower.includes("pull-request") || lower.includes("pull request") || lower.includes("pr")) tags.add("pull-request");
  if (lower.includes("github")) tags.add("github");
  if (lower.includes("jira")) tags.add("jira");
  if (lower.includes("email") || lower.includes("shortwave")) tags.add("email");
  if (lower.includes("meeting") || lower.includes("fathom")) tags.add("meeting-notes");
  if (lower.includes("salt-platform")) tags.add("salt-platform");
  if (lower.includes("production")) tags.add("production");
  return [...tags].sort();
}
