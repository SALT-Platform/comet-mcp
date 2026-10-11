---
name: Spec Plan
about: "Spequa Roadmap Spec Plan: the end-to-end requirements a feature must meet before its PR merges and ships. Unchecked boxes block unless tagged STRETCH or N/A."
title: "[Spec-NNN] <kebab-case-title>"
labels: enhancement, spequa:in-flight, roadmap
assignees: equanaut-sha-w1
---

# Requirements of Success

**SALT SPEQUA — Spec Plan issue template v1.1** · repository: `SALT-Platform/comet-mcp` · governance and drift audit: [`.github/ISSUE_TEMPLATE/README.md`](https://github.com/SALT-Platform/comet-mcp/blob/main/.github/ISSUE_TEMPLATE/README.md)

Every roadmap feature or enhancement runs through this Spec Plan before its pull request may merge and ship. Every requirement is MANDATORY unless tagged `[STRETCH]`. Governed by the CRP Authoring Rules, the 12 CRP Package Gates and the CRP-14/CRP-15 Evaluation Protocol (see [Related links](#related-links)).

## How to use this issue

- A `- [ ]` item is a mandatory gate. An unchecked mandatory item blocks the stage named in the table below.
- An item tagged `[STRETCH]` never blocks. Leave it unchecked when it is not delivered.
- An item tagged `⟨conditional: …⟩` applies only when its condition holds. When it does not, tick it and write `N/A — <reason> — <evidence link>` on the same line. An N/A without a reason and an evidence link counts as unchecked.
- Placeholders are written as inline code, for example `<lane>`, so an unfilled value stays visible in the rendered issue. Replace every one.
- §19.0 lists this repository's own checks, CI and deployment files. Gates in §19 refer to it instead of to another repository's tooling.

| Stage | Sections that must be complete | What it unblocks |
| --- | --- | --- |
| Plan freeze | §0–§18 | Implementation starts |
| PR ready for review | §19, §20 | Review; the PR may be opened earlier as a draft |
| Merge | §17 and §24 | Merge to the base branch |
| Closure | §23 | Closing this issue |

## 0. Identity & Coordinates

| Field | Value |
| --- | --- |
| Spec ID | `NNN-<kebab-case-title>` |
| Spec directory | `specs/NNN-<kebab-case-title>/` |
| Feature branch | `NNN-<kebab-case-title>` |
| Roadmap lane | `<lane>` |
| Criticality | Customer-facing / Funds-impacting / Compliance-critical / Internal only |
| Maturity target | L2 (Internal) · L3 (Funds/Compliance) |
| Accountable owner | `<@github-handle>` — `<role>` |
| Accountable owner backup | `<@github-handle>` — `<role>` (a named person, not a team) |
| Technical owner | `<@github-handle>` |
| Business owner | `<@github-handle>` |
| Independent evaluator | `<@github-handle>` (NOT the implementer) |
| Backup evaluator | `<@github-handle>` |
| Confluence CRP page | `<URL>` |
| Jira epic | `<KEY>` |
| Originating PSP | `PSP-<id> v<n>` — VALIDATED |
| Originating PROBLEMO | `PROBLEMO-<id> v<n>` |
| Originating IDEAS | `IDEAS-<id> v<n>` |
| PSP validation date | `YYYY-MM-DD` |
| CRP freeze version | `v<x.y>` — freeze date `YYYY-MM-DD` |
| Perplexity session | `<URL>` |
| SPEQUA SDD KIT index | SALT-internal Confluence page *SPEQUA Commands — Link Index* (request access from the accountable owner) |

- [ ] Every field above is filled. No `<placeholder>` remains.
- [ ] Criticality classification recorded and applied to gate thresholds.
- [ ] Accountable owner and accountable owner backup are two named people — never a team.
- [ ] Independent evaluator is not the implementer and independence is attested in writing.

## 1. PSP Admission — Upstream Contract (Gate G1)

Source: CRP Authoring Rules · Required Input Contract (CRP-00). Do not draft this Spec Plan until every input below is present or explicitly listed under MISSING-INPUT.

### 1.1 PSP records

- [ ] PROBLEMO id, version, status, authoritative link recorded
- [ ] IDEAS Solution id, version, status, authoritative link recorded
- [ ] PSP id, version, VALIDATED status, authoritative link recorded
- [ ] Canonical problem statement pasted verbatim (root-cause tagged)
- [ ] Canonical solution statement pasted verbatim
- [ ] Evidence supporting existence and impact of the problem attached
- [ ] Evidence supporting feasibility and intended effect of the solution attached
- [ ] Explicit pairing rationale: why this solution resolves this problem

### 1.2 Scope & boundary records

- [ ] In-scope systems, data, processes, populations, environments, jurisdictions listed
- [ ] Out-of-scope items listed with rationale
- [ ] Known constraints listed: policy, regulatory, contractual, technical, budgetary, security
- [ ] Known upstream and downstream dependencies listed
- [ ] Assumptions from PROBLEMO and IDEAS listed and each flagged `ASSUMPTION`

### 1.3 Measurement records

- [ ] Current-state metrics with source system, query/method, and measurement date
- [ ] Historical trend for rate- or volume-based problems
- [ ] Known instrumentation gaps listed
- [ ] Data-quality caveats affecting any metric listed

### 1.4 Governance records

- [ ] Applicable control frameworks and retention obligations recorded
- [ ] Approval authority for CRP freeze and any later change request recorded

### 1.5 MISSING-INPUT register

| MI-ID | What is missing | Why required | Owner | Blocks |
| --- | --- | --- | --- | --- |
| MI-001 | `<missing input>` | `<why it is required>` | `<@github-handle>` | `<SR/AC/BM ids or none>` |

- [ ] Zero mandatory-blocking MI-### items remain open. Non-blocking MI-### items are flagged as explicit conditional requirements resolved before first evaluation run.

## 2. Problem Truth & Falsifiable Claims (Gate G2)

Format for every claim: `<subject> <observable condition> <magnitude> <observation point>`. Reject prose. Reject unquantified adjectives. Reject activity statements.

| PC-ID | Type (root/symptom) | Falsifiable claim | Magnitude today | Evidence link | Confidence | In scope? |
| --- | --- | --- | --- | --- | --- | --- |
| PC-001 | root / symptom | `<claim>` | `<value + unit>` | `<link>` | high / medium / low | yes / no |

### 2.1 Root-cause register (RC)

One RC-ID per root cause named by the PROBLEMO root-cause analysis. §14 traces acceptance criteria back to a PC-ID or an RC-ID from this register; no other RC-ID is valid.

| RC-ID | Root cause (from the PROBLEMO root-cause analysis) | Evidence link | Root-type PC-IDs that state it | Symptom PC-IDs it explains |
| --- | --- | --- | --- | --- |
| RC-001 | `<root cause>` | `<link>` | `<PC ids>` | `<PC ids>` |

- [ ] Every claim is singular, present-tense, magnitude-bearing, observable at a named point
- [ ] Every claim is evidenced OR explicitly marked `ASSUMPTION`
- [ ] Every root-cause claim tagged and registered as an RC-ID; symptom-only coverage is a G3 fail

## 3. Overview & User Stories

### 3.1 Overview

`<1–3 paragraphs: what is being built and why it matters. Business/user value in one sentence.>`

### 3.2 User Stories

| US-ID | As | I want | So that |
| --- | --- | --- | --- |
| US-1 | `<role>` | `<capability>` | `<outcome>` |

- [ ] Every US-ID resolves to at least one AC and at least one Success Requirement (SR)

## 4. Success Requirements (Gate G5) — MANDATORY / STRETCH

Source: CRP Authoring Rules — CRP-04. Format: `<entity> <end-state condition> <quantified bound> <observation window> <verification actor>`. One requirement, one testable assertion. Split anything containing "and" that hides two assertions.

**Verification types.** `automated` is the default for every requirement an instrument can observe. `manual-observed`, `attested` and `third-party` are allowed only when the SR row declares that type, and each verification run records who verified, when (ISO-8601) and an evidence link. A non-automated SR is never reported as automated, and its verification actor is never the implementer.

| SR-ID | Class | End-state requirement | Verification type | Verification actor (non-implementer) | Traces to PC/US |
| --- | --- | --- | --- | --- | --- |
| SR-001 | MANDATORY | `<entity> <end-state> <bound> <window>` | automated / manual-observed / attested / third-party | `<@github-handle>` | `<PC-### / US-#>` |
| SR-S01 | STRETCH | `<entity> <end-state> <bound> <window>` | automated / manual-observed / attested / third-party | `<@github-handle>` | `<PC-### / US-#>` |

- [ ] Every SR is end-state phrased (not "build X" — "X produces Y under Z")
- [ ] Every SR is implementation-neutral (two reasonable architectures could satisfy it)
- [ ] Every SR is classed MANDATORY or STRETCH
- [ ] STRETCH SRs cannot delay activation or runtime certification unless promoted through approved change control BEFORE implementation begins
- [ ] Every SR names a verification actor who is NOT the implementer
- [ ] Every SR with a `manual-observed`, `attested` or `third-party` type records who verified, when and the evidence link for each run
- [ ] No vague terms: working, optimized, robust, seamless, intelligent, timely, high quality, as expected, best effort

## 5. Baselines (Gate G4)

Every metric that feeds a benchmark must have a dated, sourced, instrument-produced current value with sample window and noise band. Invented values fail G4.

| Metric | Source system / instrument id | Query or dashboard id | Measurement date | Current value | Sample window | Noise band |
| --- | --- | --- | --- | --- | --- | --- |
| `<metric>` | `<instrument id>` | `<query or dashboard id>` | `YYYY-MM-DD` | `<value + unit>` | `<window>` | `<± band>` |

- [ ] Zero invented values. Zero undated baselines. Zero unsourced baselines.
- [ ] Where instrumentation does not exist yet, an instrumentation requirement is filed and referenced.

## 6. Benchmarks (Gate G6) — All Nine Fields

A benchmark is incomplete unless all nine fields are present. Point measurements are not admissible for availability, error-rate, latency, or backlog metrics.

| BM-ID | Metric | Method | Instrument id | Baseline | Target (inequality) | Sample window + min size | Pass band | Fail band | Stability condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM-001 | `<metric>` | `<exact query / script path / connector call>` | `<instrument id>` | `<value>` | `<op> <value>` | `<window>, n ≥ <min>` | `<band>` | `<band>` | `<held for … per …>` |

- [ ] Every SR maps to ≥ 1 BM with all nine fields present
- [ ] Every target stated as 100% or 0 defines the counting rule for exceptions
- [ ] Method is executable by a stranger from the text alone (exact query, saved dashboard id, JQL, script path, or connector call)

## 7. Acceptance Criteria & Checklist (Gates G7 & G8)

Source: CRP-06. Binary. No partial credit inside a check. Boundary case explicitly assigned to PASS or FAIL. `INVALID_EVIDENCE` and `NOT_TESTED` score zero and block merge. A row marked **Mandatory = yes** blocks `VALIDATED_100` when it is not PASS, whatever the weighted score.

| AC-ID | Traces to SR | Mandatory? | Pass rule (unambiguous) | Boundary case → | Weight | Verification actor | Evidence artifact + storage + signer + retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | SR-001 | yes / no | `<rule>` | PASS / FAIL | `<n>` | `<@github-handle>` | `<artifact> · <storage> · <signer> · <retention>` |

- [ ] Weights total exactly 100 (not 97, not 104) after CRP-08 re-weighting
- [ ] Every AC row states Mandatory yes/no; the mandatory set is evaluated independently of weighted arithmetic
- [ ] Every check names artifact type, producing instrument (or the verifying person for non-automated types), storage location, signer, retention
- [ ] Redaction rules stated for any check whose evidence could contain regulated or customer data
- [ ] No check whose only evidence is "confirm with the team"

## 8. Falsification Register (Gate G9) — Anti-Gaming

For every identified gaming path, one or more counter-checks must be present and weighted into the scorecard. Each counter-check is scored through an AC row in §7, so its weight is part of the 100.

| XC-ID | Gaming path defeated | Counter-check | Type | Weight | Scored as AC-ID |
| --- | --- | --- | --- | --- | --- |
| XC-001 | `<gaming path>` | `<counter-check>` | counter / negative / regression / survivorship / silent-failure | `<n>` | `<AC-###>` |

- [ ] Every XC row has a numeric weight and the AC-ID that carries it in §7
- [ ] Negative tests present (system rejects/alerts on bad input — silence = FAIL)
- [ ] Non-regression guardrails: frozen list of previously-working behaviors that must remain intact
- [ ] Survivorship checks: outcome holds unattended across the full observation window
- [ ] Silent-failure detection: stalled/stopped component raises alert within stated detection time
- [ ] No check can be passed by turning off an alert

## 9. Test Protocol (CRP-06 / CRP-07)

| SR-ID / AC-ID | Environment | Why env is valid evidence | Test data + selection rule | Execution actor | Repeatability proof | Negative tests | Regression guardrails | Survivorship window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<ids>` | `<environment>` | `<reason>` | `<data + selection rule>` | `<@github-handle>` | `<re-run evidence>` | `<tests>` | `<guardrails>` | `<window>` |

- [ ] Environment named for every test and justified as valid evidence
- [ ] Sample selection rule prevents selection bias
- [ ] Execution actor is never the implementer for mandatory checks
- [ ] Test must produce the same verdict on re-run against the same state
- [ ] For `manual-observed`, `attested` or `third-party` checks, the repeatability proof names the observer, the observation timestamp and the evidence link

## 10. Evaluation Protocol (CRP-14 / CRP-15)

- [ ] Canonical CRP page resolves and shows a frozen version
- [ ] Package version to be evaluated recorded before scoring begins
- [ ] Evaluator independence attested in writing
- [ ] Dual control assigned where criticality requires (funds / compliance)
- [ ] Evaluator has read access to every instrument named in the evidence contract
- [ ] Evidence index page for this run created and empty at run start
- [ ] Prior run's gap tasks (§10.1) retrieved so verdict changes can be attributed
- [ ] Open change requests against the package identified

**Verdict decision tree** — every AC follows exactly: env valid? → evidence admissible? → observed value satisfies pass rule? → held for full window per stability condition? → boundary case explicitly assigned? → **PASS**. Any *no* yields `NOT_TESTED`, `INVALID_EVIDENCE`, or `FAIL`.

### 10.1 Gap-remediation task template (GAP-###)

A gap is a task, not a note (learning L-005). Every AC that returns `FAIL`, `INVALID_EVIDENCE` or `NOT_TESTED` gets exactly one GAP-### row, keyed by PSP id plus check id: a recurring failure updates its existing row with the new observation. Fields follow the gap task template of the CRP Evaluation Protocol.

| GAP-ID | Check / SR | Verdict | Current value | Target value | Numeric target delta | What must be completed next | Frozen constraints | Owner | Blocks | Re-evaluation trigger | Evidence required at re-evaluation | Tracker key | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | `<AC-### / SR-###>` | FAIL / INVALID_EVIDENCE / NOT_TESTED | `<observed value + unit>` | `<frozen target>` | `<signed numeric gap + unit>` | `<outcome instruction, implementation-neutral>` | `<policy / security / architecture constraints>` | `<@github-handle>` | `<GAP ids or none>` | task closure / cadence / deploy event / dependency completion | `<artifact + location>` | `<Jira key or GitHub issue>` | open / closed `<YYYY-MM-DD>` |

- [ ] Every non-PASS AC in the current run has exactly one GAP-### row with a numeric target delta and a tracker key
- [ ] No gap is recorded only as prose or a comment

## 11. Spequa Constitution (Nine Articles)

- [ ] **Library-First** — existing libraries preferred; new build is justified
- [ ] **Test-First** — every requirement is verifiable before implementation begins. Verification is automated by default; an SR that declares `manual-observed`, `attested` or `third-party` in §4 is verified that way, with who verified, when and the evidence link recorded
- [ ] **Simplicity** — simplest solution that fully satisfies requirements
- [ ] **Anti-Abstraction** — no premature abstractions
- [ ] **Integration-First** — integration tests prioritized over unit tests
- [ ] **Single Source of Truth** — `spec.md` is authoritative
- [ ] **Traceability** — every AC independently verifiable
- [ ] **Scope Discipline** — if it's not in the spec, it doesn't get built
- [ ] **Iterative** — unknowns flagged rather than guessed

## 12. Plan Artifacts — Required Files Before the PR Is Ready for Review

All artifacts live under `specs/NNN-<kebab-case-title>/`. The Spequa commands named here come from the `salt-spequa-commands` Claude Code plugin (`SALT-Platform/salt-plugins`); they are not files in this repository. Closure outputs (`closure-report.md`, `scorecard/`) are produced after merge and are gated in §23, not here.

- [ ] `spec.md` — status SPECIFIED, all sections filled, `## Clarifications` present
- [ ] `plan.md` — Phase 0 progress tracking complete, no ERROR states, absolute paths (from `/spequa.5-plan`)
- [ ] ⟨conditional: the plan calls for research⟩ `research.md` — validated research with citations (Phase 0)
- [ ] ⟨conditional: the change has data entities⟩ `data-model.md` — entities and relationships (Phase 1)
- [ ] ⟨conditional: the change has an API or interface boundary⟩ `contracts/` — API boundary and interface definitions (Phase 1)
- [ ] `quickstart.md` — how a stranger runs and verifies this (Phase 1)
- [ ] `tasks.md` — ordered, executable, parallelism-marked (Phase 2, from `/spequa.6-tasks`)
- [ ] `analysis-report.md` — from `/spequa.8-analyze`
- [ ] `checklist.md` — from `/spequa.7-checklist`
- [ ] `clarify-N.md` — resolved clarifications from `/spequa.4-clarify`

## 13. Task List (`/spequa.6-tasks`) — File Creation Order

Tasks MUST follow this sequence. No source-file task may run before its test-file tasks.

1. Contracts First
2. Contract Tests
3. Integration Tests
4. E2E Tests
5. Unit Tests
6. Source Files

- [ ] Every AC from `spec.md` maps to ≥ 1 task in `tasks.md`
- [ ] Every module from `plan.md` has associated tasks
- [ ] Every contract has a corresponding contract-test task
- [ ] No circular dependencies in task ordering
- [ ] Traceability matrix AC-ID → Task(s) → Status complete
- [ ] Parallelizable tasks marked `[P]`
- [ ] Every task maps to a tracker issue (Jira ticket in the correct project, or a GitHub issue) recorded in `tasks.md`

## 14. PSP Traceability Matrix (Gate G11)

| PC-ID | RC-ID (§2.1) | SR-ID | AC-ID | BM-ID | Task-ID | Evidence artifact | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<PC-###>` | `<RC-### or none>` | `<SR-###>` | `<AC-###>` | `<BM-###>` | `<T###>` | `<artifact link>` | PASS / FAIL / NOT_TESTED / INVALID_EVIDENCE |

- [ ] Every PC traces forward to ≥ 1 AC (or explicit DEFERRED with owning ticket)
- [ ] Every AC traces back to ≥ 1 PC or to an RC-ID registered in §2.1
- [ ] Zero orphans in either direction
- [ ] Every MISSING-INPUT listed, not silently filled

## 15. Validator Independence (Gate G10)

- [ ] Independent evaluator named
- [ ] Independence test recorded (attested in writing on the CRP page)
- [ ] Read access provisioned to every instrument named in the evidence contract
- [ ] Dual control assigned where funds- or compliance-impacting
- [ ] Escalation and tie-break authority written into the CRP

## 16. Governance & Closure Terms (Gate G12)

The eight closure terms. Each one is written for this PSP; a generic sentence fails G12.

| # | Closure term | What this Spec Plan must state |
| --- | --- | --- |
| 1 | Below-100 outcome | A score below 100, or any mandatory check that is not PASS, means INCOMPLETE and routes into the §10.1 gap-remediation loop |
| 2 | Change control | Versioned CR with requester, rationale, affected SR ids, impact on the 100% Definition, approver and tracker key |
| 3 | Freeze mechanics | The CRP freezes at v1.0 at CRP-12; the frozen version and date are recorded in §0 |
| 4 | Publication targets | Confluence page(s), Jira epic, GitHub spec directory, team communication channel (the salt-platform internal communications app, or `N/A` with a reason while it is not live) |
| 5 | Evaluation cadence | When CRP-14/CRP-15 runs (per PR, per phase, or on a schedule) and what triggers a re-run |
| 6 | Escalation and tie-break authority | The named person who decides when dual-control evaluators disagree |
| 7 | Recognition governance handoff | Evidence-only: this workflow never calculates or authorizes compensation |
| 8 | Retirement | When the package closes (at `/spequa.16-close`) and who records it |

- [ ] All eight closure terms above are stated and PSP-specific
- [ ] Change-control procedure stated (versioned CR, requester, rationale, affected SR ids, impact on the 100% Definition, approver, tracker key)
- [ ] Freeze mechanics defined at CRP-12
- [ ] Publication targets named
- [ ] Recognition governance handoff described as evidence-only
- [ ] Statement of what happens when the score is below 100 (route back into the §10.1 gap-remediation loop)

## 17. 12 CRP Package Gates — Pre-Freeze Scorecard (CRP-11)

All twelve must PASS. There is no weighted pass for the gates themselves.

| Gate | Name | Severity | Verdict |
| --- | --- | --- | --- |
| G1 | PSP admission integrity | CRITICAL | PASS / FAIL |
| G2 | Problem claim falsifiability | CRITICAL | PASS / FAIL |
| G3 | Coverage completeness | CRITICAL | PASS / FAIL |
| G4 | Baseline validity | CRITICAL | PASS / FAIL |
| G5 | Requirement quality | CRITICAL | PASS / FAIL |
| G6 | Benchmark completeness | CRITICAL | PASS / FAIL |
| G7 | Scorecard integrity | CRITICAL | PASS / FAIL |
| G8 | Evidence contract sufficiency | HIGH | PASS / FAIL |
| G9 | Falsification coverage | CRITICAL | PASS / FAIL |
| G10 | Validator independence | CRITICAL | PASS / FAIL |
| G11 | Traceability closure | HIGH | PASS / FAIL |
| G12 | Governance & closure terms | HIGH | PASS / FAIL |

- [ ] 12/12 gates PASS
- [ ] Zero CRITICAL failures anywhere
- [ ] SALT 28-check documentation grade ≥ B (≥ 80%)
- [ ] On-call readability test passes
- [ ] Bidirectional Confluence ↔ Jira linking resolves
- [ ] Maturity ≥ L2 (L3 for funds/compliance)

## 18. Verbatim 100% Definition (adapt only the PSP id)

> This PSP reaches VALIDATED_100 only when: every mandatory requirement is PASS; every required outcome metric reached its frozen target within tolerance; every target was sustained for its full observation period; every in-scope problem condition is covered by at least one validated requirement; every material solution promise is covered by at least one validated requirement; no critical or high-severity unresolved defect, blocker, control failure, or evidence gap remains; no frozen regression guardrail failed; every required test executed in its specified environment; every required evidence artifact exists, is current, is attributable, and is reproducible or independently inspectable; the independent evaluator signed the validation result; the implementation, evidence, validation record, and closure record are published to their authoritative sources of truth; all required operational ownership, monitoring, alerting, recovery, documentation, and maintenance controls are active; no requirement was waived, reinterpreted, or weakened without an approved and versioned change request; and the final score is exactly 100 without rounding.

- [ ] This block is pasted verbatim into `specs/NNN-<kebab-case-title>/spec.md` (Gate G7 requirement).

## 19. Pre-PR Implementation Gates

### 19.0 Repository gate profile (`SALT-Platform/comet-mcp`)

Derived on 2026-10-11 from the files on `main`. The gates below refer to these facts. If the repository's tooling changes, re-render this template (see the README) rather than editing by hand.

| Fact | Value |
| --- | --- |
| Stack | Node.js (npm) · TypeScript |
| Check commands (as defined by the repository) | `npm run build` |
| Test command | `npm test` |
| Required status checks on `main` | none |
| GitHub Actions on pull requests to `main` | `ci.yml` (CI) |
| Other GitHub Actions workflows | none |
| Other CI / build pipelines | none detected |
| Dependency manifests | `package.json` + `package-lock.json` |
| Environment example file | none |
| Tracked environment files (must hold no real secrets) | none |
| Deployment configuration | none detected |
| Runtime pins | Node.js `>=18.0.0` (`package.json` engines) |
| User interface | none detected |
| Default branch | `main` |

### 19.1 Code & CI

- [ ] Feature branch `NNN-<kebab-case-title>` created off `main`, the default branch (if the repository's contributing guide names an integration branch such as `development` or `staging`, branch from and target that branch instead)
- [ ] Every task in `tasks.md` closed with an artifact reference
- [ ] The §19.0 check commands pass on the PR head: `npm run build`
- [ ] GitHub Actions workflows that run on pull requests to `main` are green on the PR head when they run, or a failure is shown to be pre-existing on `main`: `ci.yml` (CI)
- [ ] ⟨conditional: the change adds a deployment⟩ No deployment configuration was detected (§19.0); a deployment the change adds succeeds in a non-production environment first
- [ ] No new lint warnings or suppressions without justification
- [ ] Runtime compatibility confirmed for Node.js `>=18.0.0` (`package.json` engines)
- [ ] No secrets, API keys, passwords, or credentials committed (no environment example file exists; documentation shows placeholders only)
- [ ] No `eval()`, `exec()`, unsafe shell execution, or unparameterized SQL
- [ ] ⟨conditional: the change touches authenticated routes⟩ Auth-protected routes verified behind the repository's auth guard
- [ ] ⟨conditional: the change touches form endpoints⟩ CSRF protections intact on form endpoints
- [ ] ⟨conditional: the change uses OAuth⟩ OAuth scopes not broadened without justification

### 19.2 Test coverage & quality

- [ ] New/modified logic has corresponding tests in the repository's test location
- [ ] Existing tests are not deleted or weakened without explanation
- [ ] Edge cases covered: empty data, missing env vars, unauthenticated access (where applicable)
- [ ] `npm test` run locally on the PR head, after the setup steps the repository's CI workflow or README performs first (for example config or secret bootstrap) — no regressions; test-count delta (and coverage delta where measured) reported in the PR body
- [ ] ⟨conditional: the change computes financial, allocation or scenario figures⟩ Results numerically verified against an independent calculation
- [ ] ⟨conditional: the change merges data from more than one source⟩ Data-provenance labels preserved for every source
- [ ] ⟨conditional: the change alters a JSON schema or stored data shape⟩ Change is backward-compatible or the migration path is documented
- [ ] ⟨conditional: the change mutates data⟩ Audit log entries emitted for all data-mutating operations

### 19.3 Frontend & UI/UX — ⟨conditional: the change touches a user interface (none detected in §19.0)⟩

- [ ] ⟨conditional: the change touches UI⟩ Shared layout and style patterns reused; no inline styles duplicating the repository's stylesheets
- [ ] ⟨conditional: the change touches UI⟩ WCAG AA contrast compliance maintained (per the repository's style guide, if it has one)
- [ ] ⟨conditional: the change touches UI⟩ Responsive layout not broken
- [ ] ⟨conditional: the change touches UI⟩ Screenshots attached in PR body
- [ ] ⟨conditional: the change touches charts⟩ Charts render correctly with new data shapes
- [ ] ⟨conditional: the change touches UI⟩ No JavaScript console errors on affected pages

### 19.4 API contract & backend logic — ⟨conditional: the change touches an API or backend service⟩

- [ ] ⟨conditional: the change touches an API⟩ Endpoint signatures not changed without versioning / migration note
- [ ] ⟨conditional: the change touches an API⟩ Response JSON schemas consistent with client expectations
- [ ] ⟨conditional: the change touches an API⟩ Proper HTTP status codes returned (no bare exceptions)
- [ ] ⟨conditional: the change calls external services⟩ External clients and connection managers handle timeouts gracefully
- [ ] ⟨conditional: the change touches request handling⟩ No blocking I/O on the request thread without timeout

### 19.5 Configuration & deployment

- [ ] ⟨conditional: dependencies added or changed⟩ Dependency manifest and lock data updated together with pinned or locked versions: `package.json` + `package-lock.json`
- [ ] ⟨conditional: environment variables added⟩ New environment variables documented in `README.md` (this repository has no environment example file)
- [ ] ⟨conditional: the change adds or alters a deployment (none detected in §19.0)⟩ Deployment configuration the change adds is documented in `README.md`
- [ ] ⟨conditional: the change adds or alters a deployment (none detected in §19.0)⟩ Non-production deployment tested and functional before merge
- [ ] No hardcoded localhost, ports, or file paths that break in production

### 19.6 Code quality & maintainability

- [ ] No 1000+ line single-commit PRs without logical grouping
- [ ] Functions/classes have docstrings for non-trivial logic
- [ ] No dead code, commented-out blocks, or leftover debug output
- [ ] File organization follows existing patterns
- [ ] Import structure clean; no circular imports introduced

### 19.7 Documentation & changelog

- [ ] `README.md` updated for new features / endpoints / user-facing changes
- [ ] Spec evidence committed to `specs/NNN-<kebab-case-title>/`
- [ ] ⟨conditional: the developer workflow changes⟩ `CONTRIBUTING.md` updated
- [ ] ⟨conditional: the change is breaking⟩ Migration notes recorded for breaking changes (in the PR body and the release notes or migration guide the repository uses)
- [ ] Inline comments explain why, not just what, for complex logic

## 20. PR Handoff Block — `crp_contract`

Prepare this block in `specs/NNN-<kebab-case-title>/` while §0–§19 are completed, then paste it into the PR body before the PR is marked ready for review (a draft PR may open earlier). Every verdict starts as `PENDING` and every result field as a quoted placeholder, so an untouched copy can never read as a passing certification. Keep keys, nesting and quotes exactly as shown; the reviewer in §24 compares this block with this issue and the spec directory.

```yaml
crp_contract:
  psp_id: "PSP-<id>"
  crp_version: "v<x.y>"
  crp_freeze_date: "YYYY-MM-DD"
  spec_id: "NNN-<kebab-case-title>"
  branch: "NNN-<kebab-case-title>"
  criticality: "<internal | customer-facing | funds-impacting | compliance-critical>"
  maturity_target: "<L2 | L3>"
  gates_passed:          # each gate: PENDING until evaluated, then PASS or FAIL
    G1: PENDING
    G2: PENDING
    G3: PENDING
    G4: PENDING
    G5: PENDING
    G6: PENDING
    G7: PENDING
    G8: PENDING
    G9: PENDING
    G10: PENDING
    G11: PENDING
    G12: PENDING
  salt_28_check_grade: "<A | B | PENDING>"
  onCall_readability: PENDING
  mandatory_srs_pass: "<count>/<total>"
  weighted_score: "<0-100>"
  invalid_evidence_count: "<count>"
  not_tested_count: "<count>"
  open_regression_failures: "<count>"
  open_counter_checks: "<count>"
  independent_evaluator: "<@github-handle>"
  independence_attested: "<true | false>"
  evidence_index_page: "<confluence url>"
  jira_epic: "<KEY>"
  publish_targets:
    - confluence_page: "<url>"
    - jira_epic: "<KEY>"
    - github_spec_dir: "specs/NNN-<kebab-case-title>/"
    - comms_channel: "<salt-platform internal comms channel | N/A (reason)>"
  hlb_flags: "<[] if none, else the list of HLB flags>"
  change_requests_open: "<count>"
```

- [ ] `crp_contract` block completed (no `PENDING` verdict, no placeholder) and pasted into the PR body before the PR is marked ready for review
- [ ] `agent-autonomy` label applied if no HLB flags; otherwise `human-loop-break` applied

## 21. Anti-Patterns That Fail This Template (Auto-Reject)

Any of these fails the template and blocks the PR.

- "The workflow runs successfully" — unfalsifiable
- "Deploy the new pipeline" — activity, not outcome
- "Reduce errors significantly" — unquantified adjective
- "Owner: the platform team" — must be named person + backup
- "Validated by the implementing engineer" — fails independence
- "Measured by spot check" — sample selection rule missing
- "Success = stakeholder satisfaction" — no attester, artifact, or threshold
- "Target: best effort" — no target
- Weights totalling 97 or 104 — scorecard arithmetic invalid
- Green scorecard with an open `NOT_TESTED` mandatory check
- Symptom-only coverage that leaves root-cause claims uncovered
- Baseline stated as "roughly X" with no query or date
- Point-in-time target with no observation window
- Evidence: "confirm with the team"
- A `manual-observed`, `attested` or `third-party` SR with no record of who verified, when, and the evidence link
- A gap recorded as prose with no GAP-### row and numeric target delta
- An N/A on a ⟨conditional⟩ item without a reason and an evidence link

## 22. Standing Learnings Folded In (CRP Pipeline Run Learnings)

Each was a real failure on a real run. The template already prevents each one.

- **L-001** Symptom-only coverage → §2 root/symptom tag and §2.1 RC register required; Gate G3 fails uncovered root causes
- **L-002** Targets without windows → §6 requires nine benchmark fields including window + stability
- **L-003** Green scorecard, live problem → §8 falsification counter-checks are weighted through §7
- **L-004** Self-graded work → §15 independence test + written attestation
- **L-005** Gaps that are notes, not tasks → §10.1 gap template requires a numeric target delta + a tracker key
- **L-006** Moving targets → §16 change-control procedure; freeze at v1.0
- **L-007** Invented baselines → §5 MISSING-INPUT register; G4 fails undated baselines
- **L-008** Instrument doesn't exist at eval time → §6 method executable by a stranger; missing instrument = `INVALID_EVIDENCE`

## 23. Closure and Publish Targets (after merge to `main`)

- [ ] `specs/NNN-<kebab-case-title>/closure-report.md` — SR/AC coverage table (every SR-ID and AC-ID with its final verdict and evidence), from `/spequa.16-close`
- [ ] `specs/NNN-<kebab-case-title>/scorecard/<timestamp>.yml` — Spequa closure scorecard committed
- [ ] Confluence CRP page updated with Score History entry (this run's verdict)
- [ ] Jira epic transitioned; every gap task linked
- [ ] Closure summary and evidence links posted to the team communication channel (salt-platform internal communications app; `N/A` with a reason while it is not live)
- [ ] Personal Confluence space page created with Smart Links to the originating session URL, spec directory, and PR
- [ ] Roadmap updated to reflect DONE and the next approved item released

## 24. Reviewer & Merge Rules

- The reviewer evaluates all twelve CRP package gates (G1–G12, §17) and every §19 gate as pass/fail predicates against the PR head, and checks the `crp_contract` block against this issue. In Claude Code the review runs with `/spequa.13-code-review` from the `salt-spequa-commands` plugin; that command does not parse `crp_contract` automatically, so the reviewer compares the block by hand.
- If every gate passes, the reviewer approves. If any gate fails, the reviewer requests changes with per-gate detail and the PR goes back to the repair ladder (fix, re-run the §19.0 checks, `/spequa.4-clarify` for unclear requirements). The pipeline continues to the next PR regardless.
- Merge only when every pre-merge gate (§0–§20) is checked and the repository's required checks and reviews on `main` pass; §23 is completed after merge. Merge command: **Squash and Merge**. Never Rebase or Create-Merge-Commit for spec branches.

## Related links

These SALT documents live in SALT's internal Confluence; request access from the accountable owner.

- SPEQUA Commands — Link Index (SDD KIT)
- CRP Authoring Rules and Required Input Contract
- The 12 CRP Package Gates
- CRP Evaluation Protocol (CRP-14 / CRP-15)
- CRP Pipeline Run Learnings
- Project Configuration — wf-write-success-requirements
- Product Ops — PSP Completion Requirements & Benchmarks Agentic Pipeline
- Spequa commands (`salt-spequa-commands` plugin in `SALT-Platform/salt-plugins`): `/spequa.4-clarify` · `/spequa.5-plan` · `/spequa.6-tasks` · `/spequa.7-checklist` · `/spequa.8-analyze` · `/spequa.13-code-review` · `/spequa.16-close`
- [Canonical template in `SALT-Platform/salt-platform`](https://github.com/SALT-Platform/salt-platform/blob/main/.github/ISSUE_TEMPLATE/spec-plan.md)
