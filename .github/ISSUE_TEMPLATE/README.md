# SALT SPEQUA Issue Templates — Governance Notice

This directory holds the Spequa Spec Plan issue template for `SALT-Platform/comet-mcp`. The same template is used across the non-archived repositories of the [SALT-Platform](https://github.com/SALT-Platform) GitHub organization.

## Files

| File | Purpose |
| --- | --- |
| `spec-plan.md` | The Spec Plan issue template (v1.1): the canonical body plus this repository's gate profile in §19.0. |
| `README.md` | This notice: provenance, rules and the drift audit. |

## Canonical source and provenance

- **Canonical file:** [`SALT-Platform/salt-platform` `.github/ISSUE_TEMPLATE/spec-plan.md`](https://github.com/SALT-Platform/salt-platform/blob/main/.github/ISSUE_TEMPLATE/spec-plan.md) (v1.1)
- **sha256 of the canonical file at the last sync:** `34aac3fa766522b2b7bbcac382c095bce5f6aeaf22d55e004980df9abd26b569`
- **sha256 of this repository's `spec-plan.md` at the last sync:** `cd51c09bdd42c5b5e462cfc13f1015d0a2dc0abc16a9d9619b942eff3cadf9bb`
- **Renderer:** `scripts/spec-plan-template/spec_plan_template.py` in `SALT-Platform/salt-platform` renders every copy, the canonical one included, from `scripts/spec-plan-template/spec-plan.tmpl.md` and the repository's own files.
- **History:** v1.0 from [salt-platform PR #1596](https://github.com/SALT-Platform/salt-platform/pull/1596); v1.1 (Markdown tables, task lists, visible placeholders, fenced `crp_contract`, gap-remediation template, repository gate profile) from [salt-platform PR #2719](https://github.com/SALT-Platform/salt-platform/pull/2719).
- **Standard:** SPEQUA SDD KIT (SALT-internal Confluence; request access from the accountable owner)

### What differs from the canonical file

Only the repository-specific parts, all written by the renderer:

1. The repository name and the README link in the header.
2. §19.0, the repository gate profile: stack, check commands, CI, dependency manifests, environment example file and deployment configuration, read from this repository's default branch.
3. The §19 gate lines that name those facts (base branch, checks, CI, runtime, tests, dependencies, environment file, deployment, `CONTRIBUTING.md`).
4. The default branch named in §23 and §24, and the Related links (names only, because this repository is public).

Everything else is identical to the canonical file.

## Rules for this repository

1. Every Spec Plan filed on this repository uses the `Spec Plan` issue template. Blank issues stay enabled for other issue types (bugs, questions); an issue that is a Spec Plan but was not created from this template is not admitted and is re-filed from the template.
2. Do not edit `spec-plan.md` by hand. Propose body changes in `SALT-Platform/salt-platform` against `.github/ISSUE_TEMPLATE/spec-plan.md`, then re-render this copy. Re-render as well when this repository's tooling changes, so §19.0 stays true.
3. Every unchecked box in the template is a blocker, except items tagged `[STRETCH]` (never blocking) and items tagged `⟨conditional: …⟩` that are ticked with `N/A — <reason> — <evidence link>`.
4. The template's front matter applies the labels `enhancement`, `spequa:in-flight` and `roadmap` on issue creation. All three exist in this repository (checked on 2026-10-11), so the template never silently drops them.
5. §20's `crp_contract` block is pasted into the PR body as a fenced YAML block. The reviewer compares it with the issue and the spec directory; no tool in this repository parses it.

## Drift audit

Run from the repository root (bash, `gh` authenticated):

```bash
# 1. Local copy unchanged since the last sync (hashes the committed file, so local line-ending settings do not matter):
git show HEAD:.github/ISSUE_TEMPLATE/spec-plan.md | sha256sum
# expected: cd51c09bdd42c5b5e462cfc13f1015d0a2dc0abc16a9d9619b942eff3cadf9bb

# 2. Canonical file unchanged upstream since the last sync:
gh api "repos/SALT-Platform/salt-platform/contents/.github/ISSUE_TEMPLATE/spec-plan.md?ref=main" --jq '.content' | base64 -d | sha256sum
# expected: 34aac3fa766522b2b7bbcac382c095bce5f6aeaf22d55e004980df9abd26b569
```

If check 1 differs, someone edited the local copy: restore it or re-render it. If check 2 differs, open the canonical file first: re-render this copy (and update both hashes above in the same pull request) only when the canonical is newer than this copy. A canonical that is older, for example salt-platform `main` before the v1.1 change above merged, means the mismatch is expected: change nothing, because re-rendering would downgrade this copy.

To re-render, from a `SALT-Platform/salt-platform` checkout (Python 3.10+ with PyYAML):

```bash
python scripts/spec-plan-template/spec_plan_template.py render \
  --repo SALT-Platform/comet-mcp --local <path to a checkout of this repository> \
  --default-branch <default branch> --visibility <PRIVATE|PUBLIC> \
  --required-check "<required status check>" --label "<existing label>" \
  --profile-date <YYYY-MM-DD> --v11-pr "<link to the change>" \
  --canonical .github/ISSUE_TEMPLATE/spec-plan.md --out <output dir>
python scripts/spec-plan-template/spec_plan_template.py validate <output dir>/spec-plan.md <output dir>/README.md
```

Repeat `--required-check` for each status check the default branch requires. Repeat `--label` for each of the three template labels that exists (`gh label list`); without `--label` the README states that the labels were not checked.

## Governance

- Owner: SPEQUA workflow (Shawn Owen, @equanaut-sha-w1)
- Change control: body changes land in `SALT-Platform/salt-platform` first, then every repository's copy is re-rendered in an org-wide chore sweep.
- Per-issue values (spec id, branch, owners, publish targets) are filled in each issue, never in the template.
