---
title: "RFC-004 — Decisions"
---

---

## Rejected Alternatives

| ID | Alternative                                    | Reason for rejection                                                                                                                                                                             |
|----|------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| R1 | **Module groups** (RFC-002 §8.1)               | Contradicts "one product = one release". If you need selective release — these are different products, different gover instances.                                                                |
| R2 | **Selective release** (RFC-002 §8.3)           | Consequence of R1. Without module groups, selective release has no use case.                                                                                                                     |
| R3 | **D8: `pkg/` → `cmd/`**                        | Obsolete with flat structure (D10 + D14). Single binary, no `pkg/` needed.                                                                                                                       |
| R4 | **`--isolated` flag** (user-facing GOWORK=off) | Implementation detail. gover decides internally when to use workspace mode vs `GOWORK=off`. User should not choose.                                                                              |
| R5 | **`gover doctor`**                             | Actionable error messages in boot/discovery replace the need for a separate diagnostic command. If something is permanently broken, gover says what's wrong. No separate `doctor` needed.        |
| R6 | **Bazel as alternative**                       | Bazel solves build orchestration. gover solves module governance (replace directives, go.work, architectural validation, coordinated release). Orthogonal. Bazel does not manage `go.mod` files. |
| R7 | **Plugin architecture** (RFC-004)              | Nobody writes plugins for `cat` or `ls`. Extension point is pipe, not plugin API. `gover model --json` — take the contract, do what you want. gover is a data source, not a framework.         |
| R8 | **Language-agnostic scope** (RFC-004)          | Algorithms (bump, notes) are universal. Value is Go knowledge as cement: replace directives, publish-state, go.mod transforms, Go Module Proxy immutability. Remove Go — generic tools remain.  |
| R9 | **Interactive prompts** (RFC-004)              | gover is a CLI pipe tool. Prompts break pipe: `gover bump --patch \| xargs gover release`. Warning on stderr, execution on stdout. User is in control, not the tool.                           |

---

## Decision Log

Complete decision log across all RFC versions. Decisions are final unless explicitly superseded or amended by a later decision.

### RFC-001 Decisions (2026-04-07)

| ID | Decision                                             | Rationale                                                                                                                                                     | Status                      |
|----|------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
| D1 | **Detached commit for publish-state**                | Main never leaves dev-state. Go proxy works with tags, not branches.                                                                                          | Active                      |
| D2 | ~~**Separate binaries per domain**~~                 | ~~Different domains (dev-state vs release vs versioning). JSON contract between them.~~                                                                       | **Superseded by D10**       |
| D3 | **Replace semantic-release with native subcommands** | Fundamental incompatibility: semantic-release tags main (dev-state), can't find detached tags via `git tag --merged`. Node.js dependency eliminated.          | Active                      |
| D4 | **Zero-config start**                                | Convention over configuration for uniform-lifecycle projects. `.gover/release.toml` available when customization needed. Module groups deferred (YAGNI).      | Active (amended 2026-04-12) |
| D5 | **`_` prefix = workspace-only**                      | Modules in `_`-prefixed dirs participate in dev-state but are not tagged for release. Enforced by tooling.                                                    | Active                      |
| D6 | **JSON module map as external contract**             | Versioned (`"version": 1`), absolute paths, internal requires only. Forward-compatible (ignore unknown fields). Internal communication uses typed Go structs. | Active (amended 2026-04-12) |
| D7 | **Explicit tag push, not `--tags`**                  | `git push origin --tags` pushes all local tags. Explicit list prevents leaking experimental tags.                                                             | Active                      |
| D8 | ~~**`pkg/` → `cmd/` for loose coupling**~~           | ~~Types in `cmd/` are not importable by external tools. Forces JSON as the only interface.~~                                                                  | **Superseded by D14**       |
| D9 | **`--write` as pre-publish staging area**            | Go has no `npm pack` — push tag = permanent publication. `gover release --write` creates staging worktree for analysis before the point of no return.         | Active (amended 2026-04-12) |

### RFC-002 Decisions (2026-04-12)

| ID  | Decision                                                            | Rationale                                                                                                                                                                                                                                                                                                                        | Status |
|-----|---------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| D10 | **Single binary with subcommands**                                  | Shared infrastructure (CLI layer, input resolution, boot sequence, discovery) outweighs domain separation. Shared domain (conventional commits in bump + notes) is supporting argument. Stress-tested in adversarial review ["Single binary = shared failure domain"](./disputed-points.md#single-binary-shared-failure-domain). | Active |
| D11 | **git worktree for publish-state staging**                          | Replaces detached HEAD in main worktree. Does not mutate working directory. Stateless detection (`os.Stat` on staging dir). No custom state file — git IS the state. Stress-tested in adversarial review ["git worktree admin files persist in CI"](./disputed-points.md#git-worktree-admin-files-persist-in-ci).                | Active |
| D12 | **Rebase semantics for release (`--write` / `--push` / `--abort`)** | Each operation is stateless and idempotent. State derived from filesystem (staging worktree exists = release in progress). `--write --push` for CI (no persistent state). Stress-tested in adversarial review ["Local tags trigger CI webhooks"](./disputed-points.md#local-tags-trigger-ci-webhooks).                           | Active |
| D13 | **4-level input resolution: flag > stdin > convention > defaults**  | Unix-way complementary inputs. Same pattern for all subcommands. Adding new source = new priority level, existing unchanged (OCP).                                                                                                                                                                                               | Active |
| D14 | **Flat repository structure (single go.mod)**                       | gover is a tool, not a library. `go install` is the only distribution path. `tool` directive (Go 1.24+) for dev dependencies — no `_tools/` submodule needed. Dog-fooding multi-module workflow on a single-module tool is artificial.                                                                                           | Active |
| D15 | **Platform publish out of scope**                                   | gover creates tags and generates release notes as markdown. Publishing to GitHub/GitLab/Bitbucket is a one-liner with platform CLI tools (`gh release create`, `glab release create`). No vendor lock-in.                                                                                                                        | Active |
| D16 | **resilience as reference implementation**                          | First real consumer. Multi-module Go library with core + otel extension. External validation stricter than self-hosting. README links to resilience as real-world usage example.                                                                                                                                                 | Active |

### RFC-003 Decisions (2026-04-12)

| ID  | Decision                                               | Rationale                                                                                                                                                                                            | Amends                   |
|-----|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------|
| D17 | **go.work is a generated, committed artifact**         | Main = kitchen (dev-state), not restaurant (publish-state). Replace directives are committed — go.work follows same logic. Zero setup after clone.                                                   | Strengthens RFC-002 §3.3 |
| D18 | **GOWORK=off is internal implementation detail**       | gover decides when to use workspace mode vs per-module iteration. User does not choose. Hides optimization strategy.                                                                                 | New                      |
| D19 | **Classifier rework: remove test/vet/build**           | Go workspace mode (1.18+) covers `go test ./...`, `go vet ./...`, `go build ./...` across all modules. Iteration needed only for `mod tidy` and tools with broken workspace support.                 | Amends RFC-002 §5.2      |
| D20 | **JSON output: `"releasable": false`**                 | Consumer-oriented field. Replaces need to know `_` prefix convention. Derived from convention, explicit in contract.                                                                                 | Amends RFC-002 §6.1      |
| D21 | **Terminology: "multi-module project" not "monorepo"** | Monorepo = storage strategy (many projects, one repo). Multi-module project = architecture strategy (one product, many modules). Orthogonal. gover solves the second.                                | Amends all docs          |
| D22 | **Optimization is hidden**                             | Parallelization, workspace-mode-for-speed, `GOWORK=off`-for-safety — all internal. User sees consistent behavior. May change between versions without breaking contract.                             | New                      |
| D23 | **Go version sync is a core capability**               | gover propagates root's `go` directive to all sub-modules unconditionally. Toolchain directive sync remains open (see [Toolchain Directive Sync](./history.md#toolchain-directive-sync)). Closes Q2. | Closes Q2                |
| D24 | **git worktree replaces git checkout --detach**        | Release staging uses `git worktree add`, not `git checkout --detach`. Main worktree never mutated. IDE does not reindex. Uncommitted changes safe.                                                   | Amends RFC-001 §5.2      |

### RFC-004 Decisions (2026-04-15)

| ID  | Decision                                                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                    | Amends              |
|-----|-----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------|
| D25 | **Rename multimod → gover**                                           | `multimod` lied about scope — tool governs full Go project lifecycle, not just multi-module. `gover` = `go` + `govern` (primary) + `go` + `ver` (secondary). Word "governance" already central in 3 RFCs, README, devlog. Name extracted from architecture, not invented. vanillaiice/gover — categorical difference (text replacement vs governance layer). Stress-tested in adversarial review (4 rounds).                                  | Amends all docs     |
| D26 | **Single-module projects are first-class**                            | ~~RFC-003: "No sub-modules → transparent proxy to go".~~ Revised: single-module projects get full access to bump, notes, release, build, model. Multi-module governance is one capability, not the identity. DX principle: user never hears "this is not for you". Evidence: ghset (single-module CLI) needs the same release governance as resilience (multi-module library).                                                                 | Amends RFC-003 §3.2 |
| D27 | **gover build — cross-compile + archive + checksum**                  | Governance over build process: applies convention (platform matrix from model) to mechanics (`go build`). Fundamental operations (matrix, archive, checksum) inside. Subjective (install scripts, Docker, Homebrew) outside (D15). CGO_ENABLED=0 default. Convergent design with cargo-dist. GoReleaser seals this in a monolith with proprietary YAML — gover extracts the fundamental part as composable primitive.                         | New                 |
| D28 | **gover model — extended project model (cargo metadata equivalent)**  | ~~Supersedes `gover modules` from RFC-003.~~ Extended: + platforms, + build targets, + project metadata. Schema version stays 1 (additive, not breaking). Convergent design with `cargo metadata --format-version 1` discovered post-factum. In Go ecosystem: zero tools provide structured project metadata as JSON (confirmed in 3 rounds of research). `go list -json -m` lacks build constraints, file structure, binary targets.          | Amends D6           |
| D29 | **Open config format**                                                | Config describes project convention (commit type mappings, platform matrix, notes template), not tool behavior. Format documented, versioned, open — another tool can read the same file. Litmus test: architectural property, not adoption prediction. Adoption doesn't come before proposal. Addresses vendor lock-in through configuration (`.releaserc.js`, `.goreleaser.yml`). Parsing = hardcoded (Conventional Commits). Mapping + template = config. | New                 |
| D30 | **Monolithic release tools are an anti-pattern (Deathbook)**          | GoReleaser + semantic-release conflate preparation with publication. Evidence: semantic-release has no machine-readable dry-run (confirmed). GoReleaser Pro sells prepare/publish split (paid since July 2022). Both use proprietary configs. gover's --write/--push/--abort = rebase semantics, architecturally free. 50k stars = problem is real, solution is monolith with paywall. gover offers alternative architecture, not competition. | New                 |

---

## Open Questions

| ID | Question                                             | Context                                                                                                                                                                                                                                                         |
|----|------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Q1 | **Nested sub-modules** — validate or support?        | Sub-module containing sub-modules does not contradict philosophy (core + extensions), but breaks flat invariant. Need to decide: error, warning, or full support. See ["Nested sub-modules — footgun"](./disputed-points.md#nested-sub-modules-—-footgun).      |
| Q2 | ~~**Go version sync** — core capability or opt-in?~~ | ~~Should gover propagate root's `go` directive to all sub-modules unconditionally?~~ **Closed by D23:** yes, unconditionally. Toolchain directive sync remains open (see [Toolchain Directive Sync](./history.md#toolchain-directive-sync)).                      |
| Q3 | **`go work sync` vs `gover go mod tidy`** — overlap? | `go work sync` aligns dependency versions across modules. `go mod tidy` cleans unused deps per module. Different operations, but user may confuse them. Need clear guidance.                                                                                    |
| Q4 | **Scale: 500 modules** — iteration overhead          | Philosophy allows unlimited extensions. Per-module iteration at N=500 adds measurable overhead. Internal optimization (parallelization, workspace mode) may be needed. See ["500 modules — will it scale?"](./disputed-points.md#_500-modules-—-will-it-scale). |
| Q5 | **`hasGitDir` — file vs directory**                  | Git submodules use `.git` file (not directory). Current check `info.IsDir()` misses submodule case. Minor fix needed. See ["hasGitDir — file vs directory"](./disputed-points.md#hasgitdir-—-file-vs-directory).                                                |

---

## Known Limitations & Future Work

### Module Groups — Conscious Rejection

~~Current design: all modules release with the same version. Future work: grouping mechanism.~~ **Revised after adversarial debate (see ["Zero-config doesn't scale to 40+ modules"](./disputed-points.md#zero-config-doesn-t-scale-to-40-modules)).**

Module groups are not future work — they are a rejected concept. One product = one version = one gover. If modules need independent versions, they are independent products and should be managed independently (separate gover instance or separate repo). See ["Zero-config doesn't scale to 40+ modules"](./disputed-points.md#zero-config-doesn-t-scale-to-40-modules) for the full argument, changelog test, and precedents (PHP, JetBrains).

### Rollback

With worktree-based release (see [gover release](./capabilities.md#gover-release-—-publish-state-creator)), rollback is straightforward: `gover release --abort` removes the staging worktree and deletes local tags. Idempotent — deletes what exists, ignores what doesn't. No state file to corrupt.

Previous limitation (RFC-001): "If multirelease creates tags but push fails, tags remain locally. No automatic rollback." This is resolved by the worktree approach and explicit `--abort`.
