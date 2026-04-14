---
title: "RFC-004 — Governance Tooling for Go Projects"
description: "Architectural RFC: composable governance CLI for Go projects. Renamed from multimod to gover, expanded from multi-module to full lifecycle. Evolved from RFC-003 through ecosystem research, stress-tested debates, and real-world release pipeline analysis."
---

# RFC-004 — Governance Tooling for Go Projects

|                |                                                                                                                                                          |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Status**     | Draft                                                                                                                                                    |
| **Date**       | 2026-04-15                                                                                                                                               |
| **Supersedes** | RFC-003 (2026-04-12), RFC-002 (2026-04-12), RFC-001 (2026-04-07)                                                                                         |
| **Origin**     | RFC-003 + ghset release pipeline analysis + 3 rounds ecosystem research + DeepSeek adversarial review (4 rounds) + golang/go multi-module evidence |

> **Focus on Capabilities, Not Structure Compliance.**
> This RFC describes desired behaviors and constraints. Implementation details — function names, package layout, file structure — are deliberately omitted. Code that satisfies the capabilities is correct, regardless of how it's organized.

> **This RFC is an append-only court record.** The following rules apply to all RFC documents in this project.
>
> - Content is never deleted. Superseded decisions get ~~strikethrough~~ and a reference to the replacement.
> - Disputed Points, Decision Log, and Amendment History are sacred — they document WHY, not just WHAT. A decision without its debate record is an assertion without proof.
> - Each RFC is a full snapshot. No "see previous RFC for details" — the latest RFC is self-contained.
> - IDs (E1, D1, Q1...) are never renumbered. Removed items keep their ID with a note.
> - "Simplify" means fix typos and improve clarity. It does not mean delete court records.
>
> *These rules exist because an 882-line RFC was once "simplified" into 605 lines — deleting the entire court record. Restoring it took a full session.*

---

## Problem Statement

Go has no standard tooling for project lifecycle governance.

The problem has two layers. **Multi-module projects** (one repository, multiple `go.mod` files) face unsolved dev-state and release challenges. **All Go projects** — including single-module — lack composable release tooling: version determination, release notes, cross-compilation, and pre-publish staging are either manual, depend on Node.js, or locked behind monolithic tools with proprietary configs.

**Multi-module gap.** A Go multi-module project is a single git repository containing multiple `go.mod` files — a root module and one or more sub-modules. The pattern is growing: projects with optional integrations (OTEL, gRPC, Redis) isolate dependencies into separate modules so users pull only what they need. The pattern is well-understood. The tooling is not.

**Without tooling, every multi-module Go project must solve manually:**

1. **Workspace sync** — `go.work` must list all modules. Add a module, forget to update `go.work` — IDE breaks, `go mod tidy` fetches from registry instead of local. `go work use -r .` is not a solution — it picks up `vendor/`, `testdata/`, and any stray `go.mod` without filtering **[E12]**.
2. **Replace directives** — sub-modules that depend on root (or each other) need `replace` directives pointing to local paths. Without them, `go mod tidy` fetches from registry — gets wrong version or 404.
3. **Go version alignment** — every `go.mod` should declare the same Go version. Drift causes subtle build differences. The `toolchain` directive (Go 1.21+) can silently change Go versions across modules **[E15]**.
4. **Release transforms** — dev-state `go.mod` has `replace ../` directives. Users must never see these. Before tagging a release, replaces must be stripped and internal requires pinned to the release version.
5. **Multi-module tagging** — Go proxy resolves sub-modules by prefix tag: `otel/v1.2.3` for `example.com/root/otel`. Each sub-module needs its own tag. Manual tagging is error-prone.
6. **Per-module commands** — `go mod tidy` operates on a single module; no workspace-level equivalent exists. Some tools (`govulncheck` **[E17]**, `golangci-lint` **[E10]**) don't fully support workspace mode. Each module must be handled independently for these operations.
7. **go.work footguns** — `go.work` introduces numerous documented problems (see [Evidence Base](./evidence.md), which catalogs 20 verified public sources): merge conflicts in `go.work.sum` **[E14]**, phantom workspace from parent directories **[E13]**, silent `GOWORK` env influence **[E19]**, incompatibility with vendoring **[E16]**, toolchain version drift **[E15]**. The Go team's own documentation warns against committing `go.work` — but for multi-module projects, not committing it means zero-setup after clone is impossible.
8. **Version determination** — analyzing git history to determine the next semantic version based on conventional commits. Every project reinvents this or depends on Node.js tooling.
9. **Release notes** — generating structured changelogs from conventional commits. Same reinvention problem.

**Beyond multi-module — gaps affecting ALL Go projects:**

10. **Cross-compilation distribution** — building binaries for multiple OS/architecture combinations, archiving (tar.gz/zip per OS), generating checksums. GoReleaser dominates but is a monolith with proprietary YAML config. Prepare/publish separation requires Pro (paid). No composable primitive exists for just "build matrix + archive + checksum."
11. **Pre-publish staging** — Go Module Proxy (`proxy.golang.org`) caches permanently. Push a tag with broken `go.mod` — permanent. No undo, no `npm unpublish`, no `cargo yank`. Go is the strictest ecosystem. Yet there is no staging area to verify before the point of no return. GoReleaser Pro sells `--prepare`/`--publish` split. semantic-release has no prepare/publish separation at all — not even paid.
12. **Configuration portability** — every release tool invents its own config format (`.goreleaser.yml`, `.releaserc.js`, `cliff.toml`). Change tools — rewrite config. The convention (Conventional Commits) belongs to the project, but the config format belongs to the tool. Vendor lock-in through configuration.
13. **Project metadata** — no structured JSON model of a Go project (modules, dependencies, platforms, build targets). `go list -json -m` provides basic info but no build constraints, no file structure, no binary targets. CI pipelines parse `go.mod` with grep. No equivalent of `cargo metadata --format-version 1`.

**How the ecosystem solves this today:**

- **OTEL Go** — ~3000 lines of shell scripts + `versions.yaml` config. Not reusable.
- **Kubernetes** — custom `staging/` scripts. Not reusable.
- **Everyone else** — Taskfile/Makefile with `cd sub && go test ./...` loops. Fragile, duplicated across projects.

**Cross-ecosystem comparison:**

| Problem                        | Rust           | Node            | Java        | Python           | Elixir          | **Go**             |
|--------------------------------|----------------|-----------------|-------------|------------------|-----------------|--------------------|
| Workspace init                 | `Cargo.toml`   | `package.json`  | `pom.xml`   | `pyproject.toml` | `mix.exs`       | **manual go.work** |
| Local deps in dev              | `[patch]` auto | workspaces auto | parent POM  | path deps        | `in_umbrella`   | **manual replace** |
| Dev deps don't leak to publish | auto           | auto            | auto        | auto             | auto            | **manual strip**   |
| Release tool                   | cargo-release  | changesets      | mvn release | hatch            | mix hex.publish | **none**           |
| Sub-module tagging             | cargo-release  | changesets      | mvn release | N/A              | mix             | **manual script**  |

Go is the only major language where multi-module projects have no tooling support.

**Industry avoidance strategies:** Google uses Bazel (not Go modules). Uber and HashiCorp use single module with `internal/` packages. Kubernetes uses staging repos + a publishing bot (~10k lines of infra). The absence of tooling causes the absence of multi-module projects, not the other way around.

**Real projects struggling with this today:** Uber's zap extracted benchmarks into a separate module to avoid dependency pollution, but this "complicates the build script" **[E5]**. Pulumi must "publish a tag for each go.mod path" manually **[E3]**. HashiCorp's Azure SDK split into 3 modules means "each release will become 3 separate Git Tags" **[E6]**. Grafana's replace directives from local debugging leak into shared code **[E7]**. Even goreleaser — the most popular Go release tool — "is unable to detect" sub-module tags **[E4]**. AWS acknowledges "the lack of official Golang support for this task" **[E8]**. The pattern is wanted; the tooling is missing.

**The community knows this.** A 2021 Hacker News thread **[E9]** captures the frustration: *"This is trivial to do with any other module system I've used (Maven, Nuget, Konan, pip, cargo), but it is extraordinarily brittle with Go."* One commenter argues *"Modules are not for monorepos"* — but then admits *"this requires tooling around your monorepo."* Another suggests Bazel — but Bazel solves build orchestration, not Go module governance. These are orthogonal problems. gover answers every subthread of that conversation.

This RFC proposes `gover` (go + govern) — a composable governance CLI for Go projects. It covers the full lifecycle: clone → develop → test → bump → release → build → publish. For multi-module projects: dev-state sync, workspace management, coordinated release with prefix tags. For all Go projects: version determination, release notes, cross-compilation, pre-publish staging. Its primary role is **governance**: enforcing architectural invariants and preventing irreversible mistakes that Go Module Proxy permanently records. ~~Previously named `multimod` (RFC-001 through RFC-003). Renamed in RFC-004 — see D25.~~


---

## Design Principles

### Unix Philosophy (Adapted)

Subcommands do one thing. Subcommands communicate through stdin/stdout/JSON where composition is needed. Platform-specific operations (GitHub Release, GitLab Release) are out of scope — use platform CLI tools (`gh`, `glab`).

**Litmus test:** can a user skip any subcommand and replace it with a shell script or third-party alternative? If not — the boundary is wrong.

### Target Niche: Core + Optional Extensions

The tool targets a specific Go multi-module project pattern: **root module is the core library (zero or minimal deps), sub-modules are optional extensions (own deps)**.

Users `go get` only what they need:
- `go get example.com/root` — core, zero transitive deps
- `go get example.com/root/otel` — OTEL extension, pulls only `go.opentelemetry.io/otel`

In this model: sub-modules always depend on root, never reverse. Root is the foundation. Extensions build on top. An extension cannot require a higher Go version than its core — that would mean the extension is incompatible with its own foundation.

**Examples:** OTEL Go (core + bridge/sdk), go-kit (core + transports), resilience (core + otel extension).

**Not targeted:** monorepos with independent modules that happen to share a repository (e.g. microservices). For those, each module has its own lifecycle and version — our "one version for all" model does not apply.

**Monorepo ≠ multi-module project.** A monorepo is a storage strategy (one git repo, many projects). A multi-module project is an architecture strategy (one product, many Go modules). These are orthogonal:

- A monorepo can contain multiple multi-module projects, each with its own `gover`
- A multi-module project can live in a standalone repo (not a monorepo)
- Monorepo tools (bazel, nx, turborepo) manage **which projects to build**. gover manages **how a single Go product organizes its modules**. They operate at different levels and do not conflict.

### Three Project Types (RFC-004)

Go projects fall into three categories:

1. **Single-module** — one `go.mod`, one tag, one release. Example: ghset, most Go projects, `golang.org/x/net`.
2. **Multi-module** — multiple `go.mod`, multiple tags (prefix tags), one release, one lifecycle. Example: resilience (core + otel), `golang/go` itself (std + cmd + misc — three `go.mod` files, one tag per release).
3. **Monorepo** — multiple `go.mod`, different lifecycles, different products. Example: OTEL (40+ modules with independent versions).

gover serves 1 and 2. For 3 — out of scope by design. Not a limitation. An identity.

**Evidence:** `golang/go` — the most authoritative Go project — has three `go.mod` files (`src/go.mod` → `std`, `src/cmd/go.mod` → `cmd`, `misc/go.mod` → `misc`). Tags: `go1.26.2`, `go1.25.9`... One tag per release. Three modules, one lifecycle, one version. The Go team does not independently version `std`, `cmd`, and `misc`. One product = one version.

**Single-module is first-class (RFC-004).** ~~gover activates only when it finds a root `go.mod` with sub-module `go.mod` files in subdirectories. No root `go.mod` → "not a multi-module project" → transparent proxy to `go`.~~ **Revised:** gover works with any Go project. Single-module projects get full access to `gover bump`, `gover notes`, `gover release`, `gover build`, `gover model`. Multi-module projects additionally get dev-state governance (workspace sync, replace management, go version alignment, prefix tagging). Multi-module is one of gover's capabilities, not its identity.

**No artificial limit on module count.** The tool works the same for 1 module or 500. What matters is the use case, not the count. An abstraction amplifies what matters and hides what's complex — the number of modules is irrelevant to the abstraction.

### Zero-Config Start

Directory structure is the config for discovery. A `go.mod` file in a subdirectory = a sub-module. No YAML, no TOML, no `.gover.json` required to start.

For subcommands that need configurable behavior (version bump rules, release notes formatting), configuration is opt-in via `.gover/release.toml` convention path. The tool works with sensible defaults out of the box. Configuration appears when the user needs to customize.

**Known limitation:** zero-config works for projects with uniform lifecycle (all modules release together). Projects with mixed stability levels (stable v1.x + experimental v0.x) may need a grouping mechanism. This is a conscious rejection — see [Rejected Alternatives](./decisions.md#rejected-alternatives) R1 and RFC-002 §7.4 for the full argument.

### Terraform Thinking

Discovery reads the filesystem and builds the desired State. Applier makes the filesystem match it. No diff-based patching — declare desired, apply unconditionally. Idempotent: running twice produces the same result.

### Two States of go.mod

Every sub-module's `go.mod` exists in exactly two states:

|          | Dev-state                         | Publish-state                            |
|----------|-----------------------------------|------------------------------------------|
| Replace  | `replace example.com/root => ../` | Removed                                  |
| Require  | `require example.com/root v0.0.0` | `require example.com/root v1.2.3`        |
| Where    | Main branch, always               | Detached commit behind tag (in worktree) |
| Who sees | Developers                        | Users (`go get`)                         |

Main **never leaves dev-state**. This is the core invariant. Dev-state is committed to git — Go ignores replace directives in dependencies, so users never see them.

### Detached Commit Release Model (via Worktree)

Publish-state lives on a detached git commit, accessible only via tag. `go get @v1.2.3` resolves the tag, downloads the commit, reads clean `go.mod`. The commit is not on any branch.

**Why not two commits on main (release + restore)?** Main temporarily has publish-state. CI runs between commits, someone pulls at the wrong moment — broken dev environment. Detached commit is invisible to branch-based workflows.

**Implementation: git worktree, not checkout --detach.** The release flow uses `git worktree add` to create a temporary worktree in `.gover/staging/`. The main worktree is never mutated — IDE does not reindex, uncommitted changes are safe, no `defer git checkout` dance. The staging worktree IS the state: its existence means a release is in progress. No state files, no custom state management — filesystem is the source of truth, like `internal/` in Go.

**Verified:** `proxy.golang.org` caches modules permanently after first fetch, even if the tag is deleted from the repository. Detached commits behind tags are fully supported by Go's module infrastructure.

### Complementary Inputs

Subcommands that accept configurable rules (bump rules, notes formatting) follow a 4-level fallback priority:

1. **Explicit flag** (`--config rules.toml`) — highest priority
2. **stdin pipe** (piped input) — medium priority
3. **Convention path** (`.gover/release.toml`) — low priority
4. **Hardcoded defaults** — lowest priority

"Provided explicitly? Obey. Empty? Use own heuristics."

This is the same pattern as Unix utilities: `cat file` vs `echo "text" | cat` — argument or stdin, both work. For `gover bump`: git history is implicit input (read automatically), rules are explicit input (from any channel with clear priority).

The resolution logic is shared across all subcommands. One code path, one pattern. Adding a new input source = adding a new priority level, existing sources unchanged (OCP).

### Composable, Not Framework

The tool is a set of subcommands, not a framework. Each subcommand has a clear input/output contract. Users can use only `gover` (dev-state sync) and never touch release subcommands. Or use `gover release` with a manually specified version and skip `gover bump` entirely.

**Anti-goal:** becoming semantic-release for Go. One monolithic tool that does everything and can't be decomposed.

**Platform publish is out of scope.** `gover` creates tags and generates release notes as markdown. Publishing to GitHub/GitLab/Bitbucket is a one-liner with platform CLI tools:

```bash
gover notes v1.2.3 | gh release create v1.2.3 -F -
gover notes v1.2.3 | glab release create v1.2.3 -F -
```

This keeps gover platform-agnostic. Users attach their own artifacts, use their own platform tools, control their own publish flow.

### go.work Is an Implementation Detail

**New in RFC-003.** `go.work` is a generated artifact managed by gover. It is committed to the repository for zero-setup after clone (IDE works, `go test ./...` works). But it is **not the source of truth** — the source of truth is the set of `go.mod` files discovered by gover.

gover unconditionally regenerates `go.work` from its model on every invocation. Local modifications to `go.work` are overwritten. This is by design — `go.work` has numerous documented footguns ([go.work Specific Footguns](./evidence.md#go-work-specific-footguns-rfc-003-verified)), and allowing manual edits would reintroduce the problems gover exists to solve.

**Replace directives are the core dev-state mechanism**, not `go.work`. Replace directives in `go.mod` ensure that `go mod tidy` resolves internal modules locally. `go.work` provides additional benefits (IDE cross-module navigation, `go test ./...` across all modules) but is not required for correctness.

`go.work` is a **managed artifact**. gover generates it, gover overwrites it, gover owns it. Don't edit it — your changes will be lost on the next `gover` run. It exists in the repo so that after `git clone` everything works: IDE sees all modules, `go test ./...` covers everything. That's its only job. gover handles the rest.

**Why commit go.work?** Main branch is the kitchen, not the restaurant floor. Replace directives are committed. `go.work` is committed. Both are dev-state artifacts. Neither leaks to consumers — Go ignores replace directives in dependencies, and `go.work` is not included in module downloads. After `git clone`, everything works. Zero setup.

