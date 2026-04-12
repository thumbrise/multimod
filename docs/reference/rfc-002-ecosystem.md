---
title: "RFC-002 — Composable Tooling for Go Multi-Module Monorepos"
description: "Architectural RFC: unified CLI tool for Go multi-module monorepo lifecycle. Evolved from RFC-001 through adversarial review and implementation experience, 2026-04-12."
---

# RFC-002 — Composable Tooling for Go Multi-Module Monorepos

|                |                                                                                                                   |
|----------------|-------------------------------------------------------------------------------------------------------------------|
| **Status**     | Superseded — see [Reference Index](/reference/) for latest                                                        |
| **Date**       | 2026-04-12                                                                                                        |
| **Supersedes** | RFC-001 (2026-04-07)                                                                                              |
| **Origin**     | RFC-001 adversarial review + implementation experience + second adversarial review (Critic, Implementor, Arbiter) |

::: warning Superseded
This RFC is retained as historical record. See [Reference Index](/reference/) for the latest RFC.
:::

> **Focus on Capabilities, Not Structure Compliance.**
> This RFC describes desired behaviors and constraints. Implementation details — function names, package layout, file structure — are deliberately omitted. Code that satisfies the capabilities is correct, regardless of how it's organized.

---

## 1. Problem Statement

Go has no standard tooling for multi-module monorepos.

A Go multi-module monorepo is a single git repository containing multiple `go.mod` files — a root module and one or more sub-modules. The pattern is growing: projects with optional integrations (OTEL, gRPC, Redis) isolate dependencies into separate modules so users pull only what they need.

The pattern is well-understood. The tooling is not.

**What every multi-module Go project must solve manually:**

1. **Workspace sync** — `go.work` must list all modules. Add a module, forget to update `go.work` — IDE breaks, `go mod tidy` fetches from registry instead of local.
2. **Replace directives** — sub-modules that depend on root (or each other) need `replace` directives pointing to local paths. Without them, `go mod tidy` fetches from registry — gets wrong version or 404.
3. **Go version alignment** — every `go.mod` should declare the same Go version. Drift causes subtle build differences.
4. **Release transforms** — dev-state `go.mod` has `replace ../` directives. Users must never see these. Before tagging a release, replaces must be stripped and internal requires pinned to the release version.
5. **Multi-module tagging** — Go proxy resolves sub-modules by prefix tag: `otel/v1.2.3` for `example.com/root/otel`. Each sub-module needs its own tag. Manual tagging is error-prone.
6. **Iterative commands** — `go test ./...` in root does not test sub-modules. Each module must be tested independently.
7. **Version determination** — analyzing git history to determine the next semantic version based on conventional commits. Every project reinvents this or depends on Node.js tooling.
8. **Release notes** — generating structured changelogs from conventional commits. Same reinvention problem.

**How the ecosystem solves this today:**

- **OTEL Go** — ~3000 lines of shell scripts + `versions.yaml` config. Not reusable.
- **Kubernetes** — custom `staging/` scripts. Not reusable.
- **Everyone else** — Taskfile/Makefile with `cd sub && go test ./...` loops. Fragile, duplicated across projects.

**Cross-ecosystem comparison:**

| Problem | Rust | Node | Java | Python | Elixir | **Go** |
|---|---|---|---|---|---|---|
| Workspace init | `Cargo.toml` | `package.json` | `pom.xml` | `pyproject.toml` | `mix.exs` | **manual go.work** |
| Local deps in dev | `[patch]` auto | workspaces auto | parent POM | path deps | `in_umbrella` | **manual replace** |
| Dev deps don't leak to publish | auto | auto | auto | auto | auto | **manual strip** |
| Release tool | cargo-release | changesets | mvn release | hatch | mix hex.publish | **none** |
| Sub-module tagging | cargo-release | changesets | mvn release | N/A | mix | **manual script** |

Go is the only major language where multi-module monorepo has no tooling support.

**Industry avoidance strategies:** Google uses Bazel (not Go modules). Uber and HashiCorp use single module with `internal/` packages. Kubernetes uses staging repos + a publishing bot (~10k lines of infra). The absence of tooling causes the absence of multi-module projects, not the other way around.

**Real projects struggling with this today:** Uber's zap extracted benchmarks into a separate module to avoid dependency pollution, but this "complicates the build script" **[E5]**. Pulumi must "publish a tag for each go.mod path" manually **[E3]**. HashiCorp's Azure SDK split into 3 modules means "each release will become 3 separate Git Tags" **[E6]**. Grafana's replace directives from local debugging leak into shared code **[E7]**. Even goreleaser — the most popular Go release tool — "is unable to detect" sub-module tags **[E4]**. AWS acknowledges "the lack of official Golang support for this task" **[E8]**. The pattern is wanted; the tooling is missing.

This RFC proposes `multimod` — a unified CLI tool that covers the full lifecycle: clone → develop → test → release → publish.

---

## 2. Prior Art & Analysis

### 2.1 OTEL Go multimod (opentelemetry-go-build-tools)

The largest public Go multi-module project (~40 modules) built their own tool also called `multimod` (`go.opentelemetry.io/build-tools/multimod`). The name collision is coincidental — the tools share a problem domain but differ fundamentally in approach **[E8]**.

**OTEL multimod:** config-driven. Requires `versions.yaml` that groups modules into named sets (stable-v1, experimental-metrics, bridge), each with a version number. Three CLI commands: `verify` (validate YAML), `prerelease` (update go.mod files, create branch + commit), `tag` (create git tags). Written in Go with Cobra. Tied to OTEL conventions.

**Our multimod:** convention-driven. Zero config files by default. Auto-discovers modules from filesystem. Manages go.work, replace directives, go version sync. Release via subcommand with detached commit model. Version determination and release notes as built-in subcommands.

|                       | OTEL multimod                  | Our multimod                             |
|-----------------------|--------------------------------|------------------------------------------|
| Discovery             | Manual (`versions.yaml`)       | Auto (filesystem scan)                   |
| Config                | Required (`versions.yaml`)     | None by default (convention-over-config) |
| Module groups         | Yes (named sets with versions) | No (uniform lifecycle, YAGNI)            |
| Release model         | Prerelease branch              | Detached commit via worktree             |
| Replace management    | No                             | Yes (sync + strip for publish)           |
| go.work management    | No                             | Yes (generate + sync)                    |
| Go version sync       | No                             | Yes                                      |
| JSON pipe output      | No                             | Yes                                      |
| Version determination | No                             | Yes (built-in subcommand)                |
| Release notes         | No                             | Yes (built-in subcommand)                |
| Standalone            | No (tied to OTEL)              | Yes                                      |

**What they got right:** module sets with different lifecycle (stable v1.x, experimental v0.x). Explicit grouping for large projects (40+ modules).

**What they got wrong:** config-driven discovery. YAML duplicates what `go.mod` already declares. No auto-discovery. No dev-state management (replace, go.work, go version).

### 2.2 semantic-release

The dominant release automation tool (Node ecosystem, used in Go via npx). Analyzes conventional commits, determines semver bump, creates tags and GitHub Releases.

**Fundamental incompatibility with multi-module Go:** semantic-release tags the current branch (main). In a multi-module project, main is in dev-state — `go.mod` files contain `replace ../` directives. Users who `go get @v1.2.3` receive broken go.mod. Additionally, semantic-release uses `git tag --merged` to find previous versions. Detached commits (our release model) are not reachable from main — the version chain breaks.

**Confirmed through adversarial review:** this is not a plugin/configuration issue. It is a fundamental architectural mismatch. The Node ecosystem reached the same conclusion — `changesets` replaced semantic-release for monorepo use cases (Vercel, Chakra UI, Radix).

### 2.3 goreleaser

Builds and publishes Go binaries. Does not understand Go modules, replace directives, or multi-module workspaces. Different tool for a different problem (binaries vs libraries).

### 2.4 svu, cocogitto, git-cliff

Unix-way CLI tools for version management and changelog generation. `svu` — semver from git tags. `cocogitto` — conventional commits analysis. `git-cliff` — changelog generation. Each does one thing. Composable through stdout. These validate the problem space but do not solve the multi-module lifecycle.

### 2.5 kimono (bonzai)

Part of the bonzai CLI framework by rwxrob. Provides `work` (toggle go.work), `tidy` (go mod tidy across modules), `tag` (prefix-based tagging), `deps`/`dependents` (dependency analysis). Auto-discovers modules via filesystem walk.

**What it does well:** dev-time convenience — toggling workspace, running tidy across modules.

**What it doesn't do:** no replace management, no go version sync, no release transforms (strip replaces, pin requires), no detached commit, no JSON output, no publish-state validation. Tags current HEAD directly.

**Classification:** dev convenience tool, not a release tool.

### 2.6 monorel (The Root Company)

Automates releases for individual modules in a monorepo. Generates `.goreleaser.yaml`, computes next version from git log, creates prefix tags (`cmd/tool/v1.0.0`), publishes via goreleaser + gh.

**What it does well:** binary release automation with per-module version tracking.

**What it doesn't do:** no replace management, no go.work sync, no publish-state transforms. Tightly coupled to goreleaser — designed for binaries, not libraries. No JSON output.

**Classification:** binary release tool, not a library release tool.

### 2.7 Crosslink (OTEL build-tools)

Part of OTEL's build toolchain (`go.opentelemetry.io/build-tools/crosslink`). Scans modules and inserts `replace` directives for intra-repository dependencies. Can generate `go.work`. Supports `prune` for stale replaces.

**Limitations:** requires `--root` flag or git-based root detection (not fully auto-discovery). Works only within one module namespace. Does not sync `go version`. No JSON output, not pipe-friendly. Tied to OTEL conventions.

**Classification:** partial dev-state tool — covers replace sync but not the full lifecycle.

### 2.8 Gorepomod (Kustomize/SIG)

Tool for multi-module repos in Kubernetes ecosystem (`sigs.k8s.io/kustomize/cmd/gorepomod`). Commands: `pin` (remove replaces, fix versions for publish), `unpin` (add replaces for dev), `release` (compute version, create release branch, tag, push).

**Key insight:** `pin`/`unpin` is the same two-state model as our dev-state/publish-state — different names, same concept. Confirms the pattern is real and independently discovered.

**Limitations:** uses release branches, not detached commits — mixes dev-state and publish-state on the same branch during hotfix. Tied to Kustomize structure. Last release 6+ years ago — effectively unmaintained. No JSON output.

**Classification:** partial release tool with correct model but abandoned implementation.

### 2.9 Go toolchain (`go work`, `go mod`)

`go work` manages workspace. `go mod tidy` syncs dependencies. But:

- `go work` requires manual `go work use ./otel` — no auto-discovery
- `go work` does not manage replace directives in `go.mod`
- `go mod tidy` does not sync Go version across modules
- Neither knows about releases

The tool complements Go toolchain, not competes with it. If Go adds built-in multi-module release support — the tool has served its purpose.

**Go proposals for optional dependencies:** issue [#44550](https://github.com/golang/go/issues/44550) (2019) proposed optional dependencies in `go.mod` — not implemented. Issue [#47034](https://github.com/golang/go/issues/47034) (2021) proposed optional mode for semantic import versioning — not implemented. The Go team is aware of the problem but has not prioritized it. Until they do, the gap remains.

---

## 3. Design Principles

### 3.1 Unix Philosophy (Adapted)

Subcommands do one thing. Subcommands communicate through stdin/stdout/JSON where composition is needed. Platform-specific operations (GitHub Release, GitLab Release) are out of scope — use platform CLI tools (`gh`, `glab`).

**Litmus test:** can a user skip any subcommand and replace it with a shell script or third-party alternative? If not — the boundary is wrong.

### 3.2 Target Niche: Core + Optional Extensions

The tool targets a specific Go monorepo pattern: **root module is the core library (zero or minimal deps), sub-modules are optional extensions (own deps)**.

Users `go get` only what they need:
- `go get example.com/root` — core, zero transitive deps
- `go get example.com/root/otel` — OTEL extension, pulls only `go.opentelemetry.io/otel`

In this model: sub-modules always depend on root, never reverse. Root is the foundation. Extensions build on top. An extension cannot require a higher Go version than its core — that would mean the extension is incompatible with its own foundation.

**Examples:** OTEL Go (core + bridge/sdk), go-kit (core + transports), resilience (core + otel extension).

**Not targeted:** monorepos with independent modules that happen to share a repository (e.g. microservices). For those, each module has its own lifecycle and version — our "one version for all" model does not apply.

**Monorepo ≠ multi-module project.** A monorepo is a storage strategy (one git repo, many projects). A multi-module project is an architecture strategy (one product, many Go modules). These are orthogonal:

- A monorepo can contain multiple multi-module projects, each with its own `multimod`
- A multi-module project can live in a standalone repo (not a monorepo)
- Monorepo tools (bazel, nx, turborepo) manage **which projects to build**. multimod manages **how a single Go product organizes its modules**. They operate at different levels and do not conflict.

multimod activates only when it finds a root `go.mod` with sub-module `go.mod` files in subdirectories. No root `go.mod` → "not a multi-module project" → transparent proxy to `go`. This is architectural enforcement, not documentation.

**No artificial limit on module count.** The tool works the same for 2 modules or 50. What matters is the use case (unified product with extensions), not the count. An abstraction amplifies what matters and hides what's complex — the number of consumers is irrelevant to the abstraction.

### 3.3 Zero-Config Start

Directory structure is the config for discovery. A `go.mod` file in a subdirectory = a sub-module. No YAML, no TOML, no `.multimod.json` required to start.

For subcommands that need configurable behavior (version bump rules, release notes formatting), configuration is opt-in via `.multimod/release.toml` convention path. The tool works with sensible defaults out of the box. Configuration appears when the user needs to customize.

**Known limitation:** zero-config works for projects with uniform lifecycle (all modules release together). Projects with mixed stability levels (stable v1.x + experimental v0.x) may need a grouping mechanism. This is acknowledged as future work — the architecture does not close this path, but does not solve it today.

### 3.4 Terraform Thinking

Discovery reads the filesystem and builds the desired State. Applier makes the filesystem match it. No diff-based patching — declare desired, apply unconditionally. Idempotent: running twice produces the same result.

### 3.5 Two States of go.mod

Every sub-module's `go.mod` exists in exactly two states:

|          | Dev-state                         | Publish-state                            |
|----------|-----------------------------------|------------------------------------------|
| Replace  | `replace example.com/root => ../` | Removed                                  |
| Require  | `require example.com/root v0.0.0` | `require example.com/root v1.2.3`        |
| Where    | Main branch, always               | Detached commit behind tag (in worktree) |
| Who sees | Developers                        | Users (`go get`)                         |

Main **never leaves dev-state**. This is the core invariant. Dev-state is committed to git — Go ignores replace directives in dependencies, so users never see them.

### 3.6 Detached Commit Release Model (via Worktree)

Publish-state lives on a detached git commit, accessible only via tag. `go get @v1.2.3` resolves the tag, downloads the commit, reads clean `go.mod`. The commit is not on any branch.

**Why not two commits on main (release + restore)?** Main temporarily has publish-state. CI runs between commits, someone pulls at the wrong moment — broken dev environment. Detached commit is invisible to branch-based workflows.

**Implementation: git worktree, not checkout --detach.** The release flow uses `git worktree add` to create a temporary worktree in `.multimod/staging/`. The main worktree is never mutated — IDE does not reindex, uncommitted changes are safe, no `defer git checkout` dance. The staging worktree IS the state: its existence means a release is in progress. No state files, no custom state management — filesystem is the source of truth, like `internal/` in Go.

**Verified:** `proxy.golang.org` caches modules permanently after first fetch, even if the tag is deleted from the repository. Detached commits behind tags are fully supported by Go's module infrastructure.

### 3.7 Complementary Inputs

Subcommands that accept configurable rules (bump rules, notes formatting) follow a 4-level fallback priority:

1. **Explicit flag** (`--config rules.toml`) — highest priority
2. **stdin pipe** (piped input) — medium priority
3. **Convention path** (`.multimod/release.toml`) — low priority
4. **Hardcoded defaults** — lowest priority

"Provided explicitly? Obey. Empty? Use own heuristics."

This is the same pattern as Unix utilities: `cat file` vs `echo "text" | cat` — argument or stdin, both work. For `multimod bump`: git history is implicit input (read automatically), rules are explicit input (from any channel with clear priority).

The resolution logic is shared across all subcommands. One code path, one pattern. Adding a new input source = adding a new priority level, existing sources unchanged (OCP).

### 3.8 Composable, Not Framework

The tool is a set of subcommands, not a framework. Each subcommand has a clear input/output contract. Users can use only `multimod` (dev-state sync) and never touch release subcommands. Or use `multimod release` with a manually specified version and skip `multimod bump` entirely.

**Anti-goal:** becoming semantic-release for Go. One monolithic tool that does everything and can't be decomposed.

**Platform publish is out of scope.** `multimod` creates tags and generates release notes as markdown. Publishing to GitHub/GitLab/Bitbucket is a one-liner with platform CLI tools:

```bash
multimod notes v1.2.3 | gh release create v1.2.3 -F -
multimod notes v1.2.3 | glab release create v1.2.3 -F -
```

This keeps multimod platform-agnostic. Users attach their own artifacts, use their own platform tools, control their own publish flow.

---

## 4. Tool Overview

`multimod` is a single binary with subcommands covering the full multi-module lifecycle.

```
clone → multimod → develop → multimod go → test → multimod bump → multimod release → multimod notes → platform publish
```

| Subcommand           | Domain                   | Input               | Output                  | Status      |
|----------------------|--------------------------|---------------------|-------------------------|-------------|
| **multimod** (root)  | Dev-state sync           | Filesystem          | Synced FS               | Implemented |
| **multimod go**      | Module iteration         | go args             | Per-module go output    | Implemented |
| **multimod modules** | Module map               | Filesystem          | JSON (stdout)           | Implemented |
| **multimod release** | Publish-state creation   | Version (arg)       | Detached commit + tags  | PoC         |
| **multimod bump**    | Version determination    | Git history + rules | Version string (stdout) | Planned     |
| **multimod notes**   | Release notes generation | Git history + rules | Markdown (stdout)       | Planned     |

**Adoption is incremental.** A project can use only `multimod` for dev-state sync and never touch the release subcommands. Or use `multimod release` with a manually specified version and skip `multimod bump` entirely. Each subcommand is useful in isolation.

**Third-party alternatives are welcome.** `multimod bump` can be replaced by `svu`, `cocogitto`, or a shell script. `multimod notes` can be replaced by `git-cliff`. Platform publish uses `gh`, `glab`, or any tool that creates releases. The tool does not require all subcommands — it requires the contracts between them.

### 4.1 Why a Single Binary

RFC-001 proposed separate binaries per domain (D2). This is reversed.

**Primary argument: shared infrastructure.** All subcommands share CLI layer, input resolution (§3.7), boot sequence, discovery, logging, error handling. Separate binaries = duplication or shared library (same coupling + coordination tax on the user).

**Supporting argument: shared domain.** `bump` and `notes` both parse conventional commits. Shared parsing logic lives in one place.

**Practical argument: one `go install`.** User installs one tool, gets everything. Not `go install .../multimod@v1 && go install .../version-bumper@v1 && go install .../release-notes@v1`.

**Analogy:** `git` is one binary not because `git log` and `git tag` share domain. But because they share infrastructure: object store, ref resolution, config system. Shared domain is a consequence, shared infrastructure is the cause.

**Contract is input/output format, not binary boundary.** `multimod bump` outputs a version string to stdout. Whether it's a subcommand or a separate binary — the contract is the same. If someone wants a standalone bumper — `multimod bump` works identically to a hypothetical `version-bumper` binary.

---

## 5. Subcommand Capabilities

### 5.1 multimod (root) — Dev-State Guardian

**Purpose:** guarantee that after any invocation, the filesystem matches the desired dev-state. Zero-config. Idempotent.

**Capabilities:**

- **Discovery** — scan filesystem, find all `go.mod` files, classify root vs sub-modules. Exclude `vendor/`, `testdata/`, `.`-prefixed directories. Include `_`-prefixed directories as workspace-only modules.
- **Workspace sync** — generate `go.work` with all discovered modules. Write only if content differs.
- **Replace sync** — ensure every sub-module has `replace` directives for all internal modules. Add missing, remove stale, fix incorrect paths.
- **Go version sync** — propagate root module's `go` directive to all sub-modules.
- **Validation** — reject cyclic dependencies between modules. Reject root requiring sub-modules. Clear, actionable error messages with cycle path.

**Conventions:**

- `_`-prefixed directories contain workspace-only modules — included in workspace and dev-state sync, but marked as non-releasable.
- `.`-prefixed directories are excluded entirely (hidden directories).
- `vendor/` and `testdata/` are excluded (Go convention).

### 5.2 multimod go — Module Iterator

**Purpose:** execute `go` commands across all discovered modules. Classify which commands need iteration vs passthrough.

**Capabilities:**

- **Iteration** — commands that operate on `./...` pattern (`test`, `vet`, `build`, `tool` with `./...`) are executed in each module directory.
- **Passthrough** — commands that don't need iteration (`mod tidy`, `get`) are proxied to `go` directly.
- **Transparent proxy** — if no multi-module project detected (single `go.mod`), proxy all commands to `go` unchanged.

### 5.3 multimod modules — Module Map Emitter

**Purpose:** emit JSON module map to stdout for consumption by external tools or scripts.

**Output contract:** see §6.1.

### 5.4 multimod release — Publish-State Creator

**Purpose:** transform dev-state go.mod files into publish-state, create detached commit with tags in a staging worktree. Does not determine version — receives it as argument.

**Capabilities:**

- **Plan** — compute release plan: which files to transform, which tags to create, which modules are workspace-only (not tagged).
- **Dry-run** — output plan to stdout without touching filesystem or git. Default mode.
- **Transform** — for each sub-module go.mod: strip internal replace directives, pin internal require versions to release version.
- **Validate publish-state** — after transform, before commit: run `GOWORK=off go build ./...` in each transformed module. If any module fails to build in isolation — abort, rollback, clear error. Publish-state must be proven buildable before it becomes a tag.
- **Staging worktree** — `git worktree add .multimod/staging` from current HEAD. All transforms happen in the staging worktree. Main worktree is never mutated.
- **Tagging** — tag staging commit: root tag (`v1.2.3`) + per-sub-module tags (`otel/v1.2.3`). Dev traceability tag (`v1.2.3-dev`) on original HEAD.
- **Push** — push explicit tag list to origin (not `--tags` which pushes all local tags).
- **Abort** — delete created tags, remove staging worktree. Idempotent: deletes what exists, ignores what doesn't.
- **Worktree prune** — run `git worktree prune` before `--write` to clean up stale worktree admin from previous interrupted runs.

**Release flow:**

| Mode             | What happens                                                  | Who uses                            |
|------------------|---------------------------------------------------------------|-------------------------------------|
| (default)        | Dry-run: show plan, touch nothing                             | Developer verification              |
| `--write`        | Prepare: staging worktree + transform + commit + tags locally | Pre-publish analysis (staging area) |
| `--push`         | Ship: push tags to origin + cleanup staging worktree          | After analysis passes               |
| `--abort`        | Roll back: delete tags + cleanup staging worktree             | After analysis fails                |
| `--write --push` | All-in-one: prepare + ship in one step                        | CI pipeline (no staging needed)     |

**Stateless detection:** `.multimod/staging/` directory exists = release in progress. `os.Stat()`. No state files, no custom state management. Filesystem is the source of truth.

**Rebase semantics:** like `git rebase` puts you in a rebase state, `--write` puts you in publish-state. `--push` and `--abort` both return to clean state. Like `git rebase --continue` and `git rebase --abort`.

`--write` without `--push` is Go's missing `npm pack` — local publish-state for analysis before the point of no return. See §7.7.

### 5.5 multimod bump — Version Oracle

**Purpose:** determine the next semantic version from git history. Output version string to stdout. Nothing else.

**Capabilities:**

- **Analyze commits** — parse conventional commits between last tag and HEAD. Determine bump: `feat` → minor, `fix`/`perf` → patch, `BREAKING CHANGE` or `!` → major.
- **Output** — print next version to stdout (e.g. `v1.3.0`). If no release-worthy commits — exit 0 with empty stdout (no release needed).
- **Configurable rules** — which commit types trigger which bump. Default follows conventional commits spec. Custom rules via §3.7 complementary inputs.

**May be replaced by:** `svu next`, `cog bump --auto --dry-run`, or any tool that outputs a version string.

### 5.6 multimod notes — Release Notes Generator

**Purpose:** generate structured release notes from conventional commits. Output markdown to stdout.

**Capabilities:**

- **Analyze commits** — parse conventional commits between previous tag and specified version tag.
- **Group by type** — Features, Bug Fixes, Performance Improvements, Breaking Changes, etc.
- **Output** — markdown to stdout. Designed for piping into `gh release create -F -`.
- **Configurable rules** — which commit types map to which sections. Same rules format as bump. Same resolution priority (§3.7).

**May be replaced by:** `git-cliff`, `conventional-changelog`, or any tool that generates markdown from git history.

---

## 6. Contracts & Interfaces

### 6.1 Module Map JSON (multimod modules → external tools)

The module map is the primary contract for external tool integration. Emitted by `multimod modules` on stdout.

```json
{
  "version": 1,
  "root": {
    "path": "github.com/example/project",
    "dir": "/absolute/path/to/project",
    "go_version": "1.25.0"
  },
  "subs": [
    {
      "path": "github.com/example/project/otel",
      "dir": "/absolute/path/to/project/otel",
      "requires": ["github.com/example/project"],
      "workspace_only": false
    },
    {
      "path": "github.com/example/project/tools",
      "dir": "/absolute/path/to/project/_tools",
      "requires": ["github.com/example/project"],
      "workspace_only": true
    }
  ]
}
```

**Guarantees at version 1:**

- `root` is always present, has `path` and `dir`
- `subs` is an array (may be empty)
- `dir` is absolute path
- `requires` contains only internal module paths (external deps excluded)
- `workspace_only` indicates modules that participate in dev-state but are not tagged for release
- Fields may be added in future versions — consumers must ignore unknown fields

### 6.2 Full Pipeline Example

```bash
# CI release pipeline
VERSION=$(multimod bump)
[ -z "$VERSION" ] && echo "No release needed" && exit 0
multimod release "$VERSION" --write --push
multimod notes "$VERSION" | gh release create "$VERSION" -F -
```

For projects that don't need a staging step, `--write --push` does everything in one shot. For projects that want pre-publish analysis:

```bash
VERSION=$(multimod bump)
[ -z "$VERSION" ] && exit 0

# Prepare — staging worktree created, tags created locally
multimod release "$VERSION" --write

# Analyze in staging worktree
cd .multimod/staging
govulncheck ./... && GOWORK=off go build ./...
RESULT=$?
cd ../..

# Ship or abort
if [ $RESULT -eq 0 ]; then
  multimod release --push
else
  multimod release --abort
fi
```

### 6.3 Version String (multimod bump → multimod release)

Stdout, one line, semver with `v` prefix: `v1.2.3`. Empty stdout = no release needed.

### 6.4 Release Notes (multimod notes → platform CLI)

Stdout, markdown. Designed for piping:

```bash
multimod notes v1.2.3 | gh release create v1.2.3 -F -
multimod notes v1.2.3 > RELEASE_NOTES.md
```

### 6.5 Exit Codes

All subcommands follow Unix convention:

- `0` — success (or "no action needed" for bump)
- `1` — error (message on stderr)

### 6.6 IO Convention

- **stdout** — structured output (JSON, version string, markdown). Reserved for pipe.
- **stderr** — human-readable logs, progress, errors. Tools use `slog` with component tag.

---

## 7. Disputed Points

This section documents challenges to the architecture and their resolutions — from adversarial reviews, user questions, and operational experience.

### 7.1 "Pipe-ecosystem from Go binaries is hypocrisy"

**Challenge:** Unix utilities weigh kilobytes. Each Go binary is 10-15MB. Four tools = 50MB. This is not Unix-way.

**Resolution:** argument about binary size was withdrawn by Skeptic — compile-time disk cost in 2026 is negligible. The real question was whether tools share domain knowledge (which would argue for one binary). Analysis showed that `internalPaths()` in multirelease is derivation from input data, not duplicated domain knowledge — like `wc` counting lines from stdin. The `_` prefix convention was identified as the one piece of shared knowledge — resolved by adding `workspace_only` to the JSON contract so multirelease does not need to interpret directory names.

**Precedent:** Terraform (state management) and Terragrunt (orchestration) — different binaries, different domains, communicate through files. Not plugins of each other.

**Amendment (RFC-002):** this point is superseded by D10 (single binary). The original analysis was correct — tools did not share domain knowledge at the time. The decision to merge into a single binary was driven by shared infrastructure (§3.7), not shared domain. See §7.8 for the full debate.

### 7.2 "This is just semantic-release decomposed into boxes"

**Challenge:** version-bumper + multirelease + ghreleaser = same three steps as semantic-release.

**Resolution:** rejected. The detached commit model is fundamentally different from semantic-release's branch-tagging model. semantic-release uses `git tag --merged` to find previous versions — detached commits are unreachable from main, breaking the version chain. This is not a configuration issue but an architectural incompatibility. The Node ecosystem reached the same conclusion — changesets replaced semantic-release for monorepo use cases.

### 7.3 "JSON contract is your vendor lock-in"

**Challenge:** multirelease reads JSON from multimod modules. Anyone wanting to use multirelease without multimod must generate this JSON format.

**Resolution:** partially accepted. JSON is an open format, and the contract is simple enough to generate with `jq` or any language. However, the contract needs explicit versioning and stability guarantees. Resolution: add `"version": 1` field, document guarantees, require consumers to ignore unknown fields (forward compatibility).

**Note:** compatibility with `go list -json -m all` was investigated. The formats are structurally different (stream of objects vs hierarchical document) and serve different purposes (`go list` doesn't distinguish root/sub or track internal requires). Superset is not feasible, but the module map adds genuine value over `go list`.

**Amendment (RFC-002):** with single binary (D10), JSON contract becomes internal data structure, not inter-process contract. The `multimod modules` subcommand still outputs JSON for external consumers, but bump/notes/release consume module map in-process. JSON remains the external contract; internal communication is typed Go structs.

### 7.4 "Zero-config doesn't scale to 40+ modules"

**Challenge:** OTEL has 40+ modules with different lifecycle (stable v1.x, experimental v0.x). "Release all together" doesn't work. You need module groups.

**Resolution:** rejected. The question confuses monorepo with multi-module project.

40 modules with different lifecycles is not one multi-module project — it's multiple products in one repo. A monorepo can contain several multi-module projects, each with its own multimod instance. Like a frontend team using lerna/nx inside a monorepo where backend teams don't care about lerna — each product manages its own lifecycle with its own tools.

multimod targets one product with uniform lifecycle: core + official extensions, one version, one release. Module count is irrelevant — 2 or 50 modules with uniform lifecycle work identically.

**"But what about mixed stability within one product?"** — this was stress-tested through adversarial debate with an external critic.

The critic's edge case: `acme/sdk` with `core v1.x` (stable) + `plugins/kafka v0.x` (unstable) + `plugins/cloud v1.x` (stable). "I want to release core + cloud without touching kafka."

**The changelog test:** when you write "acme/sdk v1.6.0 released" — does kafka appear in that changelog? If yes — one product, one version. That kafka's API is still unstable is a documentation concern, not a versioning concern. `go get acme/sdk/plugins/kafka@v1.6.0` gives the user exactly the version the author considers compatible with this release. If no — kafka is a separate product with its own lifecycle, and should be managed by its own multimod instance or live in its own repo.

**Precedent: PHP 8.0.** Zend Engine is the core. When JIT was added (PHP 8.0, November 2020 — new Tracing JIT and Function JIT compilation engines), PHP version bumped to a new major — architectural change to the product. But ext-redis, ext-imagick are separate products, separate authors, separate versions. PHP doesn't bump when ext-redis patches. Two levels: core + official extensions = one product. Community extensions = separate products.

**Precedent: PhpStorm 2025.3.** Adel Faizrakhmanov's Laravel Idea plugin lived for years as a separate paid plugin in JetBrains Marketplace — own version, own release cycle, own changelog. When JetBrains included it as a built-in feature in PhpStorm 2025.3 (December 2025), they bumped PhpStorm's version. Laravel support became a changelog item of the product release. The plugin is now pre-installed and enabled out of the box. Before inclusion — separate lifecycle. After inclusion — product lifecycle. Same transition: community extension → official extension = absorbed into product version.

**"Unstable" is an opinion, not a fact.** What counts as unstable? Prerelease tag (v0.x)? etcd sat on v0.x for years in production everywhere. Directory convention? Annotation? `golang.org/x/net/context` was "experimental" by naming convention but production-ready long before Go 1.7 stdlib inclusion. An OTEL-style checker that blocks stable → x/context would have blocked the entire Go ecosystem. Stability classification is a policy decision, not a tooling decision — pipe it: `multimod modules | your-stability-checker`. Same reasoning as §7.7.

**Critic's concession:** *"The philosophy of multimod is consistent and self-sufficient. It doesn't just work for simple cases — it enforces architectural discipline: if versions are independent, these are independent products, and they must be managed independently."*

**Skeptic's valid point (from RFC-001 review):** convention without enforcement is documentation, not architecture. `_` prefix is enforced by multimod (workspace-only classification) — this is tool enforcement, analogous to how Go compiler enforces `internal/`.

### 7.5 "Detached commit is a hack"

**Challenge:** Prometheus accidentally got a detached release tag — chaos ensued. What about Go proxy, GitHub Archive, `git gc`?

**Resolution:** rejected. Detached commits behind tags are fully supported by Go module infrastructure. Verified through external research: `proxy.golang.org` caches modules permanently after first fetch, even if the source tag is deleted. Tags protect commits from `git gc`. The `-dev` tag on main provides traceability (which main commit produced the release).

**"Why not release branch?"** — debated across multiple rounds. Skeptic argued release branch allows amend and has branch protection. Implementor showed the fundamental problem: release branch contains publish-state (no replaces, pinned requires). Hotfix requires restoring dev-state on the branch, patching, then re-publishing. This mixes two states on one branch. With detached commit: hotfix on any dev-state branch → new detached commit. No state mixing.

**Arbiter resolved the LTS question:** any branch (main, release/v1.2, feature/x) can be source for detached commit. LTS branch contains dev-state, releases are detached from its HEAD. Same flow everywhere:

```
main (dev-state)           → detached v1.3.0
release/v1.2 (dev-state)   → detached v1.2.4
```

**Detached commit is a design trade-off, not an innovation:**

|                       | Detached commit                      | Release branch                   |
|-----------------------|--------------------------------------|----------------------------------|
| Cleanup after release | Not needed                           | Must delete or maintain          |
| Amend before push     | New commit required                  | Amend possible                   |
| Tag protection        | Limited (GitHub tag rules)           | Branch protection (mature)       |
| Hotfix workflow       | Patch dev-state → new detached       | Must restore dev-state on branch |
| LTS support           | Separate dev-state branch + detached | Release branch per version       |
| State mixing          | Never — branches always dev-state    | Branch alternates between states |

**Bugs found during review:** (1) `git push origin --tags` pushes all local tags, not just release tags — must use explicit tag list. (2) No cleanup of tags if push fails — retry gets "tag already exists". Both accepted as implementation bugs, not architectural flaws.

### 7.6 "You compete with Go toolchain"

**Challenge:** `go work` and `go mod tidy` already solve parts of this. Go team may add more.

**Resolution:** accepted as conscious risk. The ecosystem uses `golang.org/x/mod/modfile` (official Go library) — correct side of the API boundary. If Go adds built-in multi-module release support, the ecosystem has served its purpose. Recommendation: CI job on Go release candidates to catch breaking changes early.

### 7.7 "Why don't you block on govulncheck / stable→unstable deps?"

**Challenge:** OTEL enforces that stable modules don't depend on unstable ones. Security-conscious teams run `govulncheck` as a required CI check. Why doesn't multimod block on these?

**Resolution:** rejected. These checks belong in the release pipeline, not the PR pipeline. PR pipeline gates only what the PR author controls — three litmus tests (responsibility, determinism, idempotency). If any is "no" → Observation, not Gate. `govulncheck` and stability checks fail all three.

The deeper problem is Go-specific: where do you run release-time analysis? Go has no staging area — push tag = permanent publication via immutable `proxy.golang.org` cache. Dev-state go.mod hides real versions behind `replace ../` directives. You need publish-state to analyze, but publish-state means publication.

`multimod release --write` solves this — staging worktree with publish-state, local tags without push. Go's missing `npm pack`. See §6.2 for the full workflow.

**Precedent:** Let's Encrypt Boulder made govulncheck non-blocking — *"circumstances entirely outside our control can grind Boulder development to a halt"*. Tor Project moved `cargo audit` to advisory failure.

### 7.8 "Single binary = shared failure domain"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** in the world of separate binaries, a bug in `multirelease` is fixed by updating `multirelease`. Users who only need `bump` don't download a new `multirelease`. With a mono-binary, users update everything to fix one subcommand. Separate binaries with a shared library give independent update cycles.

**Resolution:** rejected.

1. Go CLI tools have no partial update mechanism. `go install pkg@latest` downloads and compiles the entire module. Separate binaries with a shared library still require recompilation of each binary when the shared library changes.
2. Independent versioning of subcommands creates coordination burden on the user: "which version of bump is compatible with which version of release?" One binary, one version, one compatibility guarantee.
3. The alternative (shared library + separate binaries) has the same coupling — a breaking change in the shared library breaks all consumers. The difference is where the coupling is managed: in one repo (mono-binary) or across multiple repos (coordination tax).
4. Precedent: `git`, `docker`, `kubectl` — mono-binaries where a bug in `git log` ships with the same binary as `git tag`. No one demands separate `git-log` and `git-tag` binaries.

**Critic's concession:** "I can't name a single Go CLI tool that versions subcommands independently."

### 7.9 "git worktree admin files persist in CI"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** large monorepos cache `.git/` between CI runs. `git worktree add` creates entries in `.git/worktrees/`. If a previous run crashed, stale worktree admin files cause `git worktree add` to fail.

**Resolution:** accepted with mitigation. `git worktree prune` before `--write` removes stale admin entries. One-line fix. For the target niche (core + extensions, not gigabyte monorepos), `.git/` caching is uncommon. For self-hosted runners with persistent workspaces, `prune` is necessary.

**Critic's concession:** "Fair, 1:1."

### 7.10 "Local tags trigger CI webhooks"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** `--write` creates tags → CI triggers fire → `--abort` deletes tags → CI job fails on phantom tags.

**Resolution:** rejected. **Factual error by Critic.** `git tag` creates local tags. No CI system monitors local tags — CI triggers fire on `git push`, not on local operations. There is no `post-tag` hook in git. Tags become visible to CI only after `--push`. The `--write` → `--abort` cycle never touches the remote.

**Critic's concession:** "You caught me on a factual error. Question closed. 0:1."

### 7.11 "Zero config breaks where the tool is needed most"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** for 2 modules, `sed` is enough. For 15 modules with different lifecycles, zero-config can't handle it. The tool is too heavy for simple cases and too dumb for complex ones.

**Resolution:** rejected. The critique evaluates the tool against a use case it explicitly does not target. Target niche: core + optional extensions with uniform lifecycle (§3.2). Module count is not the limiting factor — architecture pattern is. 50 modules with uniform lifecycle work identically to 2. For independent-lifecycle modules (microservices in a monorepo), multimod is not the right tool — and says so in §3.2.

Even for N=2, multimod provides value that `sed` does not: acyclic dependency validation (§5.1), pre-publish staging (§5.4), `GOWORK=off` isolation check, and prevention of publishing broken go.mod to immutable Go Module Proxy.

**Critic's concession:** "I was judging a hammer by its ability to drive screws."

### 7.12 "No dog-fooding = no credibility"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** `gcc` compiles itself. `rustc` compiles itself. multimod doesn't manage its own multi-module monorepo. How can you trust a tool that doesn't eat its own dog food?

**Resolution:** rejected. multimod is a CLI tool, not a library. Its target use case is multi-module Go libraries with optional extensions. multimod itself is a single-module Go binary — it has no optional extensions, no sub-modules that users `go get` independently. Dog-fooding multi-module workflow on a single-module tool is artificial — like requiring a prosthetic limb manufacturer to amputate their own leg.

`thumbrise/resilience` serves as the first real consumer — a multi-module Go library with core + otel extension, real CI, real release pipeline. External validation is stricter than self-hosting: it catches assumptions that self-use would never expose.

**Precedent:** Terraform doesn't manage its own infrastructure with Terraform. Docker doesn't run inside Docker in production. The tool's domain and the tool's own build process are different domains.

**Critic's concession:** "The prosthetic analogy is apt. I withdraw the objection."

### 7.13 "Acyclic validation is a black box"

**Origin:** RFC-002 adversarial review, 2026-04-12.

**Challenge:** user creates a cyclic dependency (root → plugin → root). multimod blocks the release. User has no lever to fix it without refactoring. The tool is a black box that says "no" without explaining how to fix it.

**Resolution:** rejected with evidence. multimod outputs the full cycle path in the error message: `cyclic dependency detected: A → B → C → A — extract one module into a separate repository`. The error fires at discovery phase, before any git operation. The fix is architectural (break the cycle), not configurational — and the error message says exactly what to do.

Allowing users to bypass acyclic validation (e.g., via config flag) would enable publishing broken modules to the immutable Go Module Proxy. This is not a safety net you remove — it's a guardrail on a cliff.

**Critic's concession:** "You didn't just block the release — you showed me the working code and tests. My 'Vasya Pupkin' mine exploded in my own hands."

### 7.14 "Why cwd-is-root? What if I want to run from a subdirectory?"

**Challenge:** I'm in `otel/` and want to run multimod. Why force me to `cd ..`?

**Resolution:** rejected. `go.mod` files are not unique markers — there could be 10 in a directory tree. Traversing upward without a boundary is a footgun. Same convention as goreleaser and terraform: cwd is the project root. No upward traversal, zero edge cases.

Additionally, `go.work` might not exist yet — multimod creates it. Using `go.work` as root marker is chicken-and-egg.

### 7.15 "Why unconditional replaces for ALL modules? That's noisy!"

**Challenge:** sub-module `otel/` only depends on root. Why does it get replace directives for every other sub-module too?

**Resolution:** rejected. Chicken-and-egg problem. Developer writes `import "example.com/root"` → runs `go mod tidy` → tidy adds `require` → but no replace exists yet → tidy fetches from registry → gets wrong version or 404. The replace must exist **before** the require. Unconditional replaces guarantee this. Unused replaces are harmless — Go ignores them.

### 7.16 "Why commit go.work? The Go team says not to!"

**Challenge:** Go documentation advises against committing `go.work`. You're going against the official recommendation.

**Resolution:** rejected. The Go team's advice targets single-module projects where `go.work` is a local dev convenience. For multi-module monorepos, committed `go.work` means: after `git clone`, IDE works, `go mod tidy` works, `go test` works. Zero setup. The alternative — every developer runs `go work use ./otel ./grpc ./redis` after clone — is fragile and undiscoverable.

### 7.17 "You commit replace directives?! Users will get broken go.mod!"

**Challenge:** replace directives in committed go.mod will break consumers who `go get` the module.

**Resolution:** rejected. **Factual error.** Go **ignores** replace directives in dependencies. When a user does `go get example.com/your/module@v1.2.3`, Go reads the go.mod from the tagged commit but skips all replace directives. This is how Go works by design — replace is local-only. Users never see dev-state. The publish-state commit (behind the tag) has replaces stripped anyway as an extra safety layer.

### 7.18 "What if someone imports my -dev tag?"

**Challenge:** the `-dev` traceability tag on main (`v1.2.3-dev`) could be imported by users, giving them dev-state go.mod.

**Resolution:** rejected. The `-dev` suffix is a semver pre-release identifier. `go get @latest` ignores pre-release versions by spec. A user would have to explicitly type `go get example.com/root@v1.2.3-dev`. And if they do — `require example.com/root v0.0.0` in dev-state will fail loudly at resolution. No silent bugs.

### 7.19 "I renamed my module directory and releases broke!"

**Challenge:** renamed `otel/` to `observability/`, now old tags don't work, users' imports broke.

**Resolution:** not a multimod problem. Renaming a Go module directory = changing the module path = breaking change for every downstream consumer. `github.com/you/project/otel` and `github.com/you/project/observability` are two different modules — like two different npm packages. Old tags still point to the old module path. New directory has zero release history. Every user must change their import paths manually. This is Go's rule, not multimod's. multimod sees current state, not history.

### 7.20 "CI shows zero releases! All my tags are gone!"

**Challenge:** ran multimod in CI, it reports no previous versions. All tags disappeared.

**Resolution:** not a multimod problem. Your CI does `git clone --depth 1`. Shallow clone doesn't fetch tags. Add `fetch-depth: 0` or `git fetch --tags` to your CI config. multimod reports what it sees in local git — no tags locally means no tags reported. multimod warns if it detects a shallow clone with zero tags, but it won't fix your pipeline for you.

### 7.21 "My root module depends on sub-modules. Will this work?"

**Challenge:** root imports a sub-module. multimod rejects it.

**Resolution:** rejected by design. Root is the zero-deps core. Sub-modules depend on root, not reverse. If root depends on a sub-module, the dependency graph has a cycle (root → sub → root via transitive) or root pulls sub-module's dependencies — defeating the purpose of multi-module isolation. multimod rejects this at discovery phase with a clear error: `root module must not require internal sub-modules`. The fix is architectural: extract the shared code into root, or move the dependency into a separate sub-module. This is the standard Go multi-module convention (OTEL, Kubernetes, every major project).

---

## 8. Known Limitations & Future Work

### 8.1 Module Groups — Conscious Rejection

~~Current design: all modules release with the same version. Future work: grouping mechanism.~~ **Revised after adversarial debate (§7.4).**

Module groups are not future work — they are a rejected concept. One product = one version = one multimod. If modules need independent versions, they are independent products and should be managed independently (separate multimod instance or separate repo). See §7.4 for the full argument, changelog test, and precedents (PHP, JetBrains).

### 8.2 Rollback

**Updated in RFC-002.** With worktree-based release (§4), rollback is straightforward: `multimod release --abort` removes the staging worktree and deletes local tags. Idempotent — deletes what exists, ignores what doesn't. No state file to corrupt.

Previous limitation (RFC-001): "If multirelease creates tags but push fails, tags remain locally. No automatic rollback." This is resolved by the worktree approach and explicit `--abort`.

### 8.3 Selective Release

Current: release all modules or nothing. Future work: selective release of individual modules or groups. Likely tied to §8.1 (module groups).

### 8.4 Template Generation

Templates (dependabot.yml, CI configs) generated from module map via `.multimod/templates/`. Orthogonal to release — part of multimod's dev-state responsibilities.

### 8.5 Integration Testing on Go RC

No CI job on Go release candidates. Risk: Go toolchain changes could break multimod. Mitigation: `golang.org/x/mod/modfile` is stable API, but semantic changes in `go mod tidy` or `go work` could affect behavior. Note: a CI job on Go RC is an Observation, not a Gate — non-idempotent by definition. See §7.7.

### 8.6 CI Isolation Check

`go.work` in repository root changes behavior of `go build` and `go test` — they use local modules instead of published ones. CI must include a `GOWORK=off go test ./...` step to verify that published modules work in isolation. Without this, a release may break users who consume modules individually.

### 8.7 Toolchain Directive Sync

Go 1.21+ introduced `toolchain` directive in `go.mod`. Currently multimod syncs `go` version but not `toolchain`. Future work: sync both, or make `toolchain` sync optional.

### 8.8 Retract Automation

`go mod retract` is the only way to mark a broken published version. Currently requires manual intervention. Future work: `multimod retract v1.2.3` command that creates a new detached commit with retract directive and tags it as the next patch version.

### 8.9 Release Validation

Before creating detached commit, release subcommand validates: all internal replaces are stripped, all internal requires are pinned, no local-path replaces remain. Strict validation prevents publishing broken go.mod.

### 8.10 Atomic Multi-Module Release

When modules have cross-dependencies (A depends on B), release order matters: B must be tagged before A's go.mod can reference B's version. Current approach: all modules tagged simultaneously with the same version. Future work: dependency-aware release ordering for independent versioning scenarios.

### 8.11 Declarative CLI Layer

Current Cobra commands are thin but self-serving — each command registers its own flags, reads them, and validates them. Adding the 4-level input resolution (§3.7) to each command will create duplication. Future work: declarative layer where commands declare their inputs (type, required, description, example) and a shared system resolves them. Analogous to Laravel's invokable actions with declared dependencies vs Yii2's fat controllers. This will emerge naturally from duplication — not designed upfront.

---

## 9. Decision Log

| #   | Decision                                                        | Rationale                                                                                                                                                                                                                                 | Date                           |
|-----|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|
| D1  | Detached commit for publish-state                               | Main never leaves dev-state. Go proxy works with tags, not branches.                                                                                                                                                                      | 2026-04-07                     |
| D2  | ~~Separate binaries per domain~~                                | ~~Different domains (dev-state vs release vs versioning). JSON contract between them.~~ **Superseded by D10.**                                                                                                                            | 2026-04-07                     |
| D3  | Replace semantic-release with native subcommands                | Fundamental incompatibility: semantic-release tags main (dev-state), can't find detached tags via `git tag --merged`. Node.js dependency eliminated.                                                                                      | 2026-04-07                     |
| D4  | Zero-config start                                               | Convention over configuration for uniform-lifecycle projects. `.multimod/release.toml` available when customization needed. Module groups deferred (YAGNI).                                                                               | 2026-04-07, amended 2026-04-12 |
| D5  | `_` prefix = workspace-only                                     | Modules in `_`-prefixed dirs participate in dev-state but are not tagged for release. Enforced by tooling.                                                                                                                                | 2026-04-07                     |
| D6  | JSON module map as external contract                            | Versioned (`"version": 1`), absolute paths, internal requires only. Forward-compatible (ignore unknown fields). Internal communication uses typed Go structs.                                                                             | 2026-04-07, amended 2026-04-12 |
| D7  | Explicit tag push, not `--tags`                                 | `git push origin --tags` pushes all local tags. Explicit list prevents leaking experimental tags.                                                                                                                                         | 2026-04-07                     |
| D8  | `pkg/` → `cmd/` for loose coupling                              | Types in `cmd/` are not importable by external tools. Forces JSON as the only interface. Architectural enforcement, not documentation.                                                                                                    | 2026-04-07                     |
| D9  | `--write` as pre-publish staging area                           | Go has no `npm pack` — push tag = permanent publication. `multimod release --write` creates staging worktree for analysis before the point of no return.                                                                                  | 2026-04-07, amended 2026-04-12 |
| D10 | Single binary with subcommands                                  | Shared infrastructure (CLI layer, input resolution, boot sequence, discovery) outweighs domain separation. Shared domain (conventional commits in bump + notes) is supporting argument. Stress-tested in adversarial review §7.8.         | 2026-04-12                     |
| D11 | git worktree for publish-state staging                          | Replaces detached HEAD in main worktree. Does not mutate working directory. Stateless detection (`os.Stat` on staging dir). No custom state file — git IS the state. Stress-tested in adversarial review §7.9.                            | 2026-04-12                     |
| D12 | Rebase semantics for release (`--write` / `--push` / `--abort`) | Each operation is stateless and idempotent. State derived from filesystem (staging worktree exists = release in progress). `--write --push` for CI (no persistent state). Stress-tested in adversarial review §7.10.                      | 2026-04-12                     |
| D13 | 4-level input resolution: flag > stdin > convention > defaults  | Unix-way complementary inputs. Same pattern for all subcommands. Adding new source = new priority level, existing unchanged (OCP).                                                                                                        | 2026-04-12                     |
| D14 | Flat repository structure (single go.mod)                       | multimod is a tool, not a library. `go install` is the only distribution path. `tool` directive (Go 1.24+) for dev dependencies — no `_tools/` submodule needed. Dog-fooding multi-module workflow on a single-module tool is artificial. | 2026-04-12                     |
| D15 | Platform publish out of scope                                   | multimod creates tags and generates release notes as markdown. Publishing to GitHub/GitLab/Bitbucket is a one-liner with platform CLI tools (`gh release create`, `glab release create`). No vendor lock-in.                              | 2026-04-12                     |
| D16 | resilience as reference implementation                          | First real consumer. Multi-module Go library with core + otel extension. External validation stricter than self-hosting. README links to resilience as real-world usage example.                                                          | 2026-04-12                     |

---

## Appendix A: Evidence Base

Public sources confirming the problem space and validating design decisions. Each link verified for existence, quote accuracy, and contextual relevance.

### A.1 Go Issues — Official Recognition

- **[E1]** [golang/go#75900](https://github.com/golang/go/issues/75900) — *"replace directives don't really work because it breaks go install for that command package."* Multi-module updates in same repo require multiple commits.
- **[E2]** [golang/go#51967](https://github.com/golang/go/issues/51967) — *"it is more likely that people will take code intended for local development and deploy it into a production environment."* go.work as production risk.

### A.2 Real Projects — Pain Documentation

- **[E3]** [pulumi/pulumi#4213](https://github.com/pulumi/pulumi/issues/4213) — *"we need to publish a tag for each go.mod path."* Manual multi-module tagging burden.
- **[E4]** [goreleaser/goreleaser#1848](https://github.com/goreleaser/goreleaser/issues/1848) — *"Goreleaser is unable to detect those tags at the moment."* Popular release tool lacks multi-module support.
- **[E5]** [uber-go/zap@fd38d2a](https://github.com/uber-go/zap/commit/fd38d2a0cbc80152758800ff5d7e676e748d33af) — *"To keep the list of direct dependencies of Zap minimal, benchmarks are placed in their own Go module."* Dependency isolation via multi-module.
- **[E6]** [hashicorp/pandora#3601](https://github.com/hashicorp/pandora/issues/3601) — *"each release will become 3 separate Git Tags — one per submodule."* HashiCorp facing same tagging problem.
- **[E7]** [grafana/grafana#72346](https://github.com/grafana/grafana/pull/72346) — *"this line is giving me some errors due to inconsistency in the versions."* Replace directives from local debugging leak into shared code.

### A.3 Industry Analysis

- **[E8]** [AWS Blog: Simplifying OpenTelemetry releases with MultiMod](https://aws.amazon.com/cn/blogs/opensource/simplifying-opentelemetry-collector-and-go-library-releases-with-the-go-multimod-tool/) — *"Managing versions and releases of multiple Go Modules can be a struggle... especially due to the lack of official Golang support for this task."*
- **[E9]** [Hacker News discussion](https://news.ycombinator.com/item?id=27028202) — *"This is trivial to do with any other module system I've used (Maven, Nuget, Konan, pip, cargo), but it is extraordinarily brittle with Go."*

---

## Appendix B: Amendment History

### B.1 RFC-002 Amendment (2026-04-12)

**Origin:** Architecture review session + four-round adversarial debate (Implementor vs Critic, with Arbiter).

**Why this amendment exists:**

RFC-001 was written on 2026-04-07 as the initial architectural vision. Five days of implementation and design thinking revealed that several RFC-001 decisions, while correct at the time, were based on incomplete understanding of the problem space. Specifically:

1. **Separate binaries (D2) assumed domain separation was the primary concern.** Implementation revealed that shared infrastructure (CLI layer, input resolution, boot sequence, module discovery) creates more maintenance burden than domain separation prevents. The tools don't share domain knowledge, but they share everything else.

2. **Detached HEAD (D9) assumed main worktree mutation was acceptable.** Design of `--abort` semantics revealed that detached HEAD requires custom state management (state file, corruption handling, cleanup). git worktree eliminates this entirely — the filesystem IS the state.

3. **Zero-config (D4) was presented as absolute.** Real-world use cases (conventional commit mapping, release note formatting) require configuration. The principle was refined: zero-config START, not zero-config FOREVER. Convention file (`.multimod/release.toml`) appears when needed.

4. **Dog-fooding was assumed necessary.** multimod is a tool for multi-module libraries. multimod itself is a single-module tool. Forcing multi-module structure on multimod for dog-fooding purposes would be artificial architecture — broken window by definition.

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

### B.2 Module Groups Rejection (2026-04-12)

**Origin:** Adversarial debate with external critic (DeepSeek), moderated by Arbiter (project author).

**What changed:** §7.4 rewritten from "accepted as future limitation" to "rejected". §8.1 changed from "future work" to "conscious rejection".

**Why:** RFC-001 and early RFC-002 treated module groups (modules with different versions within one project) as a legitimate future need, citing OTEL's 40+ modules with mixed stability levels. Three insights invalidated this:

1. **Monorepo ≠ multi-module project.** 40 modules with different lifecycles is multiple products in one repo, not one product. Each can have its own multimod instance. Like lerna/nx managing frontend inside a monorepo where backend teams are unaffected.

2. **Stability analysis ≠ release tooling.** "Stable module depends on unstable module" is a policy check, not a release concern. Same reasoning as §7.7 (govulncheck): responsibility, determinism, idempotency — all three "no". Pipe it: `multimod modules | your-stability-checker`.

3. **"Unstable" is undefined.** v0.x? etcd ran v0.x in production for years. x/ package? golang.org/x/net/context was production-ready before Go 1.7 stdlib inclusion. Stability is an opinion that changes over time — not a property a release tool should encode.

**The changelog test** (discovered during debate): if an extension appears in the product's changelog — it's part of the product, one version. If it has its own changelog — it's a separate product, separate lifecycle. PHP 8.0 JIT bumped PHP's major version. ext-redis patches don't. PhpStorm 2025.3 absorbed Laravel Idea plugin — version bumped. Before that, Laravel Idea had its own marketplace version.

**Critic's concession:** *"The philosophy of multimod is consistent and self-sufficient. It enforces architectural discipline: if versions are independent, these are independent products, and they must be managed independently."*

---

*This RFC is a snapshot of the project vision as of 2026-04-12. It supersedes RFC-001 for all decisions listed in the Decision Log. RFC-001 remains as historical record. Future changes will produce RFC-003 with its own amendment history.*
