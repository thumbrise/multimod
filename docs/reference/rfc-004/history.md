---
title: "RFC-004 — History"
---


### Selective Release

Current: release all modules or nothing. Consequence of [Module Groups — Conscious Rejection](./decisions.md#module-groups-—-conscious-rejection) (module groups rejection). Without module groups, selective release has no use case. See [Rejected Alternatives](./decisions.md#rejected-alternatives) R2.

### Template Generation

Templates (dependabot.yml, CI configs) generated from module map via `.gover/templates/`. Orthogonal to release — part of gover's dev-state responsibilities.

### Integration Testing on Go RC

No CI job on Go release candidates. Risk: Go toolchain changes could break gover. Mitigation: `golang.org/x/mod/modfile` is stable API, but semantic changes in `go mod tidy` or `go work` could affect behavior. Note: a CI job on Go RC is an Observation, not a Gate — non-idempotent by definition. See ["Why don't you block on govulncheck"](./disputed-points.md#why-don-t-you-block-on-govulncheck-stable→unstable-deps).

### CI Isolation Check

`go.work` in repository root changes behavior of `go build` and `go test` — they use local modules instead of published ones. CI must include a `GOWORK=off go test ./...` step to verify that published modules work in isolation. Without this, a release may break users who consume modules individually.

### Toolchain Directive Sync

Go 1.21+ introduced `toolchain` directive in `go.mod`. Currently gover syncs `go` version but not `toolchain`. Future work: sync both, or make `toolchain` sync optional. See D23.

### Retract Automation

`go mod retract` is the only way to mark a broken published version. Currently requires manual intervention. Future work: `gover retract v1.2.3` command that creates a new detached commit with retract directive and tags it as the next patch version.

### Release Validation

Before creating detached commit, release subcommand validates: all internal replaces are stripped, all internal requires are pinned, no local-path replaces remain. Strict validation prevents publishing broken go.mod.

### Atomic Multi-Module Release

When modules have cross-dependencies (A depends on B), release order matters: B must be tagged before A's go.mod can reference B's version. Current approach: all modules tagged simultaneously with the same version. Future work: dependency-aware release ordering for independent versioning scenarios.

### Declarative CLI Layer

Current Cobra commands are thin but self-serving — each command registers its own flags, reads them, and validates them. Adding the 4-level input resolution (see [Complementary Inputs](./#complementary-inputs)) to each command will create duplication. Future work: declarative layer where commands declare their inputs (type, required, description, example) and a shared system resolves them. This will emerge naturally from duplication — not designed upfront.

---

## Amendment History

### Version Summary

| Version     | Date           | Summary                                                                                                                                                                                                                                                                            |
|-------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| RFC-001     | 2026-03-28     | Initial design. Single-tool approach. Three-round adversarial review (Skeptic, Implementor, Arbiter). 9 decisions (D1–D9), 9 evidence links, 7 disputed points, 10 known limitations.                                                                                              |
| RFC-002     | 2026-04-12     | Single binary. Second adversarial review (Critic, Implementor, Arbiter). 7 new decisions (D10–D16), 14 new disputed points (§7.8–7.21), module groups rejection. 882 lines.                                                                                                        |
| **RFC-003** | **2026-04-12** | **Positioning shift: governance layer / go.work tamer. 8 new decisions (D17–D24), 6 rejections, 11 new evidence links (20 total). Terminology fix: monorepo → multi-module project. Classifier rework. go.work ecosystem analysis. Court record from design session: 18 debates.** |
| **RFC-004** | **2026-04-15** | **Rename multimod → gover. Scope expansion: multi-module → full Go project lifecycle. Single-module first-class. 6 new decisions (D25–D30), 3 new rejections (R7–R9). New subcommands: gover build, gover model. Open config format. Three Project Types classification. golang/go evidence. 3 rounds ecosystem research + 4 rounds adversarial review (DeepSeek). Deathbook: GoReleaser + semantic-release as monolithic anti-pattern.** |

### RFC-002 Amendment (2026-04-12)

**Origin:** Architecture review session + four-round adversarial debate (Implementor vs Critic, with Arbiter).

**Why this amendment exists:**

RFC-001 was written on 2026-04-07 as the initial architectural vision. Five days of implementation and design thinking revealed that several RFC-001 decisions, while correct at the time, were based on incomplete understanding of the problem space. Specifically:

1. **Separate binaries (D2) assumed domain separation was the primary concern.** Implementation revealed that shared infrastructure (CLI layer, input resolution, boot sequence, module discovery) creates more maintenance burden than domain separation prevents. The tools don't share domain knowledge, but they share everything else.

2. **Detached HEAD (D9) assumed main worktree mutation was acceptable.** Design of `--abort` semantics revealed that detached HEAD requires custom state management (state file, corruption handling, cleanup). git worktree eliminates this entirely — the filesystem IS the state.

3. **Zero-config (D4) was presented as absolute.** Real-world use cases (conventional commit mapping, release note formatting) require configuration. The principle was refined: zero-config START, not zero-config FOREVER. Convention file (`.gover/release.toml`) appears when needed.

4. **Dog-fooding was assumed necessary.** gover is a tool for multi-module libraries. gover itself is a single-module tool. Forcing multi-module structure on gover for dog-fooding purposes would be artificial architecture — broken window by definition.

**Adversarial review summary:**

Four rounds of debate between Implementor (defender) and Critic (experienced Go developer maintaining a 15-module monorepo). Arbiter (project author) moderated.

**Critic's concessions (attacks withdrawn):**
- CI triggers from local tags — factual error (no `post-tag` hook in git)
- Target niche too narrow — "I was judging a hammer by its ability to drive screws"
- Acyclic validation is a black box — working code and tests demonstrated otherwise
- No dog-fooding — "the prosthetic analogy is apt"

**Critic's accepted contributions (improvements adopted):**
- `git worktree prune` before `--write` for self-hosted CI runners
- Idempotent `--abort` implementation
- Explicit tag list enforcement (D7 — known but not implemented)

**Critic's final verdict:** *"The tool is young but the foundation is solid. My skepticism is reclassified from 'tool is bad' to 'tool is young but very promising.'"*

**Decisions changed:**
- D2: Separate binaries → Single binary (D10)
- D4: Zero-config → Zero-config start
- D9: Detached HEAD staging → Worktree staging (D11)

**Decisions added:** D10–D16.

### Module Groups Rejection (2026-04-12)

**Origin:** Adversarial debate with external critic (DeepSeek), moderated by Arbiter (project author).

**What changed:** §7.4 rewritten from "accepted as future limitation" to "rejected". §12.1 changed from "future work" to "conscious rejection".

**Why:** RFC-001 and early RFC-002 treated module groups (modules with different versions within one project) as a legitimate future need, citing OTEL's 40+ modules with mixed stability levels. Three insights invalidated this:

1. **Monorepo ≠ multi-module project.** 40 modules with different lifecycles is multiple products in one repo, not one product. Each can have its own gover instance. Like lerna/nx managing frontend inside a monorepo where backend teams are unaffected.

2. **Stability analysis ≠ release tooling.** "Stable module depends on unstable module" is a policy check, not a release concern. Same reasoning as §7.7 (govulncheck): responsibility, determinism, idempotency — all three "no". Pipe it: `gover model | your-stability-checker`.

3. **"Unstable" is undefined.** v0.x? etcd ran v0.x in production for years. x/ package? golang.org/x/net/context was production-ready before Go 1.7 stdlib inclusion. Stability is an opinion that changes over time — not a property a release tool should encode.

**The changelog test** (discovered during debate): if an extension appears in the product's changelog — it's part of the product, one version. If it has its own changelog — it's a separate product, separate lifecycle. PHP 8.0 JIT bumped PHP's major version. ext-redis patches don't. PhpStorm 2025.3 absorbed Laravel Idea plugin — version bumped. Before that, Laravel Idea had its own marketplace version.

**Critic's concession:** *"The philosophy of gover is consistent and self-sufficient. It enforces architectural discipline: if versions are independent, these are independent products, and they must be managed independently."*

### RFC-003 Amendment (2026-04-12)

**Origin:** go.work ecosystem analysis + evidence-based positioning review + design session with 18 debates.

**What changed:**
- Positioning: "release tool" → "governance layer / go.work tamer"
- Terminology: "monorepo" → "multi-module project" everywhere
- go.work: generated, committed, managed artifact (D17)
- GOWORK=off: internal implementation detail (D18)
- Classifier: test/vet/build removed from iteration (D19)
- JSON contract: `"releasable": false` replaces `"workspace_only": true` (D20)
- Evidence base: 11 new go.work footgun sources (E10–E21)
- HN thread E9: deep analysis with per-participant gover answers
- 6 rejected alternatives (R1–R6)
- Court record: 18 debates from design session incorporated into [Disputed Points](./disputed-points.md)

### RFC-003 Amendment (2026-04-14)

**Origin:** code review of gover-to-root PR (single-module consolidation per D14).

**What changed:**
- JSON contract: `go_version` → `goVersion` (camelCase). Aligns with de-facto JSON convention (GitHub API, Kubernetes API, OTEL, Go stdlib `encoding/json`). Pre-release, zero consumers — convention alignment, not breaking change. Schema example and contract guarantees updated. Amends D6.

### RFC-004 Amendment (2026-04-15)

**Origin:** ghset release pipeline analysis (PRs #20, #23) + 3 rounds ecosystem research with DeepSeek + 4 rounds adversarial review + golang/go structure analysis + user dialogue stress-testing.

**Why this amendment exists:**

RFC-003 positioned gover (then `multimod`) as "Governance Tooling for Go Multi-Module Projects". Real-world experience building a release pipeline for ghset — a single-module CLI tool — revealed that the tool's philosophy and capabilities apply to all Go projects, not just multi-module. The name `multimod` lied about scope.

Simultaneously, analysis of GoReleaser and semantic-release exposed fundamental architectural problems: monolithic design conflating preparation with publication, proprietary configs creating vendor lock-in, and composable features locked behind paywalls. Three rounds of ecosystem research confirmed these gaps exist across the entire Go ecosystem with zero tools addressing them.

**What changed:**
- Rename: `multimod` → `gover` (D25). Name extracted from architecture — "governance" was already the central word.
- Scope: "Go Multi-Module Projects" → "Go Projects". Single-module is first-class (D26).
- New subcommands: `gover build` (D27) — cross-compile + archive + checksum. `gover model` (D28) — extended project model, supersedes `gover modules`.
- Open config format (D29) — config describes convention, not tool behavior. Documented, versioned, portable.
- Deathbook entry (D30) — monolithic release tools that conflate preparation with publication identified as anti-pattern.
- Three Project Types classification: single-module, multi-module, monorepo. gover serves first two.
- Evidence: `golang/go` has three `go.mod` files, one tag per release — confirms one product = one version philosophy.
- 3 new rejected alternatives: plugin architecture (R7), language-agnostic scope (R8), interactive prompts (R9).
- Prior art expanded: go-semantic-release v2, uplift, gommitizen, cargo-dist, release-please.
- Convergent design with Cargo documented: cargo package = --write, cargo publish = --push, cargo metadata = gover model.

**Adversarial review summary:**

Four rounds of debate with DeepSeek as angry user / skeptic. All 6 decisions (D25–D30) stress-tested. Key attacks and resolutions:
- "Independent versioning in multi-module" — rejected 4 times. Three Project Types classification + golang/go evidence closed the question.
- "Plugin architecture needed" — rejected. `cat`/`ls` analogy: primitives with clear contracts, extension through pipe not plugins.
- "50k stars means good tool" — 50k stars means problem is real, solution is monolith with paywall.
- "Litmus test for open config is hypothetical" — adoption doesn't come before proposal. Architectural property, not adoption metric.
- "CGO limitation" — not gover's limitation, environment limitation. `go build` fails the same way.

**Decisions added:** D25–D30. **Rejections added:** R7–R9.
