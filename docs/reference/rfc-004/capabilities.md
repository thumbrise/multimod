---
title: "RFC-004 — Capabilities"
---

---

## Tool Overview

`gover` is a single binary with subcommands covering the full Go project lifecycle.

```
clone → gover → develop → gover go → test → gover bump → gover release → gover build → gover notes → platform publish
```

| Subcommand        | Domain                 | Input              | Output                  | Status      |
|-------------------|------------------------|--------------------|-------------------------|-------------|
| **gover** (root)  | Dev-state sync         | Filesystem         | Synced FS               | Implemented |
| **gover go**      | Module iteration       | go args            | Per-module go output    | Implemented |
| **gover model**   | Full project model     | Filesystem + conf  | JSON (stdout)           | Planned     |
| **gover release** | Publish-state creation | Version (arg)      | Detached commit + tags  | PoC         |
| **gover bump**    | Version determination  | Git history        | Version string (stdout) | Planned     |
| **gover notes**   | Release notes          | Git history + conf | Markdown (stdout)       | Planned     |
| **gover build**   | Binary production      | Project model      | dist/ (binaries+sums)   | Planned     |

**Amendment (RFC-004):** two new subcommands. `gover build` — cross-compile + archive + checksum (see D27). `gover model` — extended project model replacing `gover modules` from RFC-003 (see D28). ~~`gover modules` from RFC-003 is superseded by `gover model`.~~

**Adoption is incremental.** A project can use only `gover` for dev-state sync and never touch the release subcommands. Or use `gover release` with a manually specified version and skip `gover bump` entirely. Each subcommand is useful in isolation.

**Third-party alternatives are welcome.** `gover bump` can be replaced by `svu`, `cocogitto`, or a shell script. `gover notes` can be replaced by `git-cliff`. Platform publish uses `gh`, `glab`, or any tool that creates releases. The tool does not require all subcommands — it requires the contracts between them.

### Why a Single Binary

RFC-001 proposed separate binaries per domain (D2). This is reversed.

**Primary argument: shared infrastructure.** All subcommands share CLI layer, input resolution (see [Complementary Inputs](./#complementary-inputs)), boot sequence, discovery, logging, error handling. Separate binaries = duplication or shared library (same coupling + coordination tax on the user).

**Supporting argument: shared domain.** `bump` and `notes` both parse conventional commits. Shared parsing logic lives in one place.

**Practical argument: one `go install`.** User installs one tool, gets everything. Not `go install .../gover@v1 && go install .../version-bumper@v1 && go install .../release-notes@v1`.

**Analogy:** `git` is one binary not because `git log` and `git tag` share domain. But because they share infrastructure: object store, ref resolution, config system. Shared domain is a consequence, shared infrastructure is the cause.

**Contract is input/output format, not binary boundary.** `gover bump` outputs a version string to stdout. Whether it's a subcommand or a separate binary — the contract is the same. If someone wants a standalone bumper — `gover bump` works identically to a hypothetical `version-bumper` binary.

---

## Subcommand Capabilities

### gover (root) — Dev-State Guardian

**Purpose:** guarantee that after any invocation, the filesystem matches the desired dev-state. Zero-config. Idempotent.

**Capabilities:**

- **Discovery** — scan filesystem, find all `go.mod` files, classify root vs sub-modules. Exclude `vendor/`, `testdata/`, `.`-prefixed directories. Include `_`-prefixed directories as workspace-only modules (not tagged for release, but part of dev-state).
- **Workspace sync** — generate `go.work` with all discovered modules. Write only if content differs. `go.work` is an implementation detail (see [go.work Is an Implementation Detail](./#go-work-is-an-implementation-detail)) — gover owns it unconditionally.
- **Replace sync** — ensure every sub-module has `replace` directives for all internal modules. Add missing, remove stale, fix incorrect paths. Unconditional: replace exists before require, preventing chicken-and-egg with `go mod tidy`.
- **Go version sync** — propagate root module's `go` directive to all sub-modules.
- **Validation** — reject cyclic dependencies between modules. Reject root requiring sub-modules. Clear, actionable error messages with cycle path.

**Conventions:**

- `_`-prefixed directories contain workspace-only modules — included in workspace and dev-state sync, but not tagged for release. Always in `go.work` — they are part of the project, IDE must see them.
- `.`-prefixed directories are excluded entirely (hidden directories).
- `vendor/` and `testdata/` are excluded (Go convention).

**Why not `go work use -r .`?** Discovery is opinionated where `go work use -r .` is not. `go work use -r .` walks the filesystem and includes every `go.mod` it finds — `vendor/`, `testdata/`, hidden dirs (`.git/`), even intentionally malformed test fixtures **[E12]**. gover Discovery applies convention-based exclusion: skip `vendor/`, `testdata/`, `.`-prefixed dirs, and only include valid `go.mod` files. This is the difference between "find all" and "find what belongs to the project."

| Behavior                | `go work use -r .`                    | gover discovery            |
|-------------------------|---------------------------------------|----------------------------|
| `vendor/`               | Included **[E12]**                    | Excluded                   |
| `testdata/`             | Included **[E12]**                    | Excluded                   |
| `.`-prefixed dirs       | Included                              | Excluded                   |
| Hidden dirs (`.git/`)   | Included                              | Excluded                   |
| Malformed test `go.mod` | Included (breaks workspace) **[E12]** | Excluded                   |
| Filtering               | None — only checks `go.mod` exists    | Convention-based exclusion |

Evidence: [golang/go#51959](https://github.com/golang/go/issues/51959) — `go work use -r .` on `golang.org/x/tools` picks up intentionally malformed `go.mod` files from test fixtures, creating an unusable workspace.

### gover go — Module Iterator

**Purpose:** execute `go` commands across all discovered modules where Go workspace mode does not provide coverage.

**Key insight (RFC-003):** Go workspace mode (Go 1.18+) makes `go test ./...`, `go vet ./...`, and `go build ./...` work across all modules. gover does not re-implement this. gover go iterates only commands that workspace mode does not cover.

**Capabilities:**

- **Iteration** — commands that require per-module execution: `mod tidy` (no workspace equivalent), `tool <name> ./...` (tools with broken workspace support).
- **Optimization** — gover may internally use workspace mode (`go.work`) or `GOWORK=off` + per-module iteration depending on the command. This is an internal implementation detail — the user does not choose. gover always produces correct results regardless of strategy.
- **Transparent proxy** — commands that don't need iteration pass through to `go` directly. The user does not know gover is involved. If no multi-module project is detected — warning and exit, not silent failure.

### Workspace Applier

Generates `go.work` from discovered state. The file is created from scratch on every run — never patched, never merged with user edits. This is the core anti-footgun: `go.work` is a **derived artifact**, not a source of truth.

**Mechanism:** take root's Go version, list all discovered modules as `use` directives with relative paths. Compare with existing `go.work` — write only if content differs (idempotent). Filtering decisions belong to Discovery — Applier writes whatever Discovery put into state. Single responsibility: state → `go.work` file.

**Who consumes `go.work`:**

- **IDE (gopls)** — full cross-module navigation, Find All References, refactoring. Without `go.work`, gopls in zero-config mode (v0.15+) provides partial support via `replace` directives (sub → root works, root → sub does not).
- **Workspace-aware Go commands** — `go test ./...`, `go vet ./...`, `go build ./...` cover all modules when `go.work` is present.

gover does **not** use `go.work` as input — Discovery reads `go.mod` files directly. But gover **may** use `go.work` as a Go toolchain optimization lever (e.g. workspace-mode test execution). `go.work` is output, not input.

---

### Replace Applier

Manages `replace` directives in every sub-module's `go.mod`. Replace directives are the **primary dev-state mechanism** — they existed before `go.work` (Go 1.18) and work without it.

**Mechanism:** unconditional replaces for all internal modules. Every sub gets `replace` for root + every other sub. Add missing, drop stale, preserve external (not managed by gover). Write only if changed (idempotent).

**Why unconditional replaces:**

- `replace` before `require` — when a developer adds `require` for an internal module, the `replace` is already in place. `go mod tidy` never fetches internal modules from registry.
- Unused replaces are harmless — Go ignores `replace` directives with no matching `require`.
- Predictable — no "did I forget to add a replace?" debugging.

**Dev-state vs publish-state:**

|                    | Dev-state (main)        | Publish-state (detached commit)         |
|--------------------|-------------------------|-----------------------------------------|
| Replace directives | Present (local paths)   | **Removed** (consumers use registry)    |
| Require versions   | As-is (may be `v0.0.0`) | **Pinned** to release version           |
| go.work            | Present                 | **Absent** (not relevant for consumers) |

---

### gover build — Binary Production (RFC-004)

**Purpose:** cross-compile Go binaries for multiple platforms, archive per OS convention, generate checksums. Governance over build process — applies convention (platform matrix from model) to mechanics (`go build`).

**Capabilities:**

- **Cross-compile** — iterate GOOS × GOARCH matrix. Default: `linux/amd64`, `linux/arm64`, `darwin/amd64`, `darwin/arm64`, `windows/amd64`, `windows/arm64` (6 targets, covers 95%+ use cases). Custom matrix via open config.
- **Archive** — `tar.gz` for Linux/macOS, `zip` for Windows. OS-appropriate convention, not user choice.
- **Checksum** — `sha256` for all archives. Single `checksums.txt` file. Format: `sha256  filename` per line. Compatible with `sha256sum --check`.
- **Output** — all artifacts in `dist/`. Predictable structure, ready for `gh release create dist/*`.

**Scope boundary (fundamental vs subjective):**

- **Fundamental (inside gover):** cross-compile matrix, archive per OS, checksum. These are algorithms — deterministic, testable, no platform dependency.
- **Subjective (outside gover):** install scripts, Docker images, Homebrew formulas, `.deb`/`.rpm` packages, GPG signing, SBOM generation. These are platform-specific or policy-specific — out of scope (D15).

**CGO:** `gover build` defaults to `CGO_ENABLED=0`. This covers the vast majority of Go CLI tools and libraries. CGO cross-compilation requires C toolchains per target — platform-specific infrastructure, not Go governance. If you need CGO cross-compile, use Docker + xgo. This is not a gover limitation — it's an environment limitation. `go build` without a C toolchain fails the same way with or without gover.

**Parallelism:** internal implementation detail (D22). gover decides the strategy. User sees consistent results.

**Why not just `go build` + `tar` + `sha256sum`?** Because matrix iteration, archive format per OS, checksum file generation, naming conventions — nontrivial glue. Shell scripts for this aren't testable. GoReleaser sealed this logic inside a monolith with proprietary YAML config because the glue is real. gover extracts the fundamental part as a composable primitive.

**Convergent design:** `cargo-dist` (Rust) solves the same problem separately from `cargo-release`. gover build separately from gover release. Same separation, independently discovered.

**Don't need gover build?** Don't use it. Use GoReleaser, use your own builder. Your builder doesn't know the project model? `gover model --json` — take the contract and do whatever you want. gover is a data source, not a framework.

---

### gover model — Full Project Model (RFC-004)

**Purpose:** output structured JSON model of the entire Go project to stdout. Designed for piping into external tools, CI scripts, and builders — including `gover build` itself.

~~Replaces `gover modules` from RFC-003.~~ Extended from module map to full project model. Schema remains version 1 — new fields are additive, not breaking (forward compatibility by contract).

**What's new vs RFC-003 `gover modules`:**

- **Platforms** — GOOS/GOARCH matrix from config or defaults
- **Build targets** — discovered `main` packages
- **Project metadata** — name, description, version from git tags
- **Release config** — commit type mappings, notes template path

**Convergent design with `cargo metadata --format-version 1`:** same principles (structured stdout, versioned schema, forward compatibility) led to same architecture independently. Discovered post-factum — JSON Output Contract was designed in RFC-001 through analogy with `docker inspect`, `terraform state`, `kubectl get -o json`.

**In Go ecosystem, nothing equivalent exists.** `go list -json -m` provides basic module info but no build constraints, no file structure, no binary targets. CI pipelines parse `go.mod` with grep. Three rounds of ecosystem research confirmed: zero tools provide structured project metadata as JSON. gover model fills this gap.

---

### gover release — Publish-State Creator

**Purpose:** transform dev-state go.mod files into publish-state, create detached commit with tags in a staging worktree. Does not determine version — receives it as argument.

**Capabilities:**

- **Plan** — compute release plan: which files to transform, which tags to create, which modules are workspace-only (not tagged).
- **Dry-run** — output plan to stdout without touching filesystem or git. Default mode.
- **Transform** — for each sub-module go.mod: strip internal replace directives, pin internal require versions to release version.
- **Validate publish-state** — after transform, before commit: run `GOWORK=off go build ./...` in each transformed module. If any module fails to build in isolation — abort, rollback, clear error. Publish-state must be proven buildable before it becomes a tag.
- **Staging worktree** — `git worktree add .gover/staging` from current HEAD. All transforms happen in the staging worktree. Main worktree is never mutated.
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

**Stateless detection:** `.gover/staging/` directory exists = release in progress. `os.Stat()`. No state files, no custom state management. Filesystem is the source of truth.

**Rebase semantics:** like `git rebase` puts you in a rebase state, `--write` puts you in publish-state. `--push` and `--abort` both return to clean state. Like `git rebase --continue` and `git rebase --abort`.

`--write` without `--push` is Go's missing `npm pack` — local publish-state for analysis before the point of no return. See ["Why don't you block on govulncheck"](./disputed-points.md#why-don-t-you-block-on-govulncheck-stable→unstable-deps).

**Detailed flow:**

```
1. Tag current HEAD: v1.2.3-dev          (traceability anchor)
2. git worktree prune                    (clean stale admin from previous runs)
3. git worktree add .gover/staging/   (main untouched)
4. Build publish-state via pipeline       (strip replaces, pin versions)
5. Apply publish-state to staging         (rewrite go.mod files)
6. Validate: GOWORK=off go build ./...   (each module must build in isolation)
7. git add -A && git commit              (detached commit in staging)
8. Tag staging commit: v1.2.3            (root tag)
9. Tag staging commit: otel/v1.2.3       (per-sub-module tags)
10. Remove staging worktree              (cleanup, or keep for --push)
11. git push origin <explicit tag list>  (publish, if --push)
```

**Why `v1.2.3-dev` on HEAD?** The detached commit is not on any branch — `git log main` will never show it. The `-dev` tag on the source commit creates a bidirectional traceability link: from main you see which commits became releases (`git tag --list '*-dev'`), and from a release tag you can find the source commit (`git log v1.2.3` shows its parent). Without this anchor, the only way to connect a release to its source is `git log --all --ancestry-path` — which requires knowing the detached commit exists in the first place. In feature branches, `-dev` tags visually mark release points in `git log --oneline`.

**`_` prefix convention:** Sub-modules whose directory starts with `_` (e.g. `_tools/`) are workspace-only — included in `go.work`, included in dev-state operations, but **not tagged for release**. They exist for development (linters, generators, test utilities) and are not published to Go Module Proxy.

**DryRun:** dry-run mode returns a plan describing what will happen — tags, modified files, commit message — without touching the filesystem. Enables preview and CI validation.

---

## JSON Output Contract

`gover model` outputs the full project model as JSON to stdout. Designed for piping into external tools (`jq`, scripts, CI pipelines, custom builders).

**Amendment (RFC-004):** schema extended with platforms, build targets, project metadata. Additive changes — version stays 1. ~~v1 schema from RFC-003 (`gover modules`) is extended, not replaced.~~

**Schema (v1, extended) — approximate vision, exact structure will be determined during implementation:**

```json
{
  "version": 1,
  "root": {
    "path": "github.com/example/root",
    "dir": "/abs/path/to/root",
    "goVersion": "1.23"
  },
  "subs": [
    {
      "path": "github.com/example/root/otel",
      "dir": "/abs/path/to/root/otel",
      "requires": ["github.com/example/root"]
    },
    {
      "path": "github.com/example/root/tools",
      "dir": "/abs/path/to/root/_tools",
      "requires": [],
      "releasable": false
    }
  ],
  "platforms": [
    {"os": "linux", "arch": "amd64"},
    {"os": "linux", "arch": "arm64"},
    {"os": "darwin", "arch": "amd64"},
    {"os": "darwin", "arch": "arm64"},
    {"os": "windows", "arch": "amd64"},
    {"os": "windows", "arch": "arm64"}
  ],
  "targets": [
    {"path": "github.com/example/root/cmd/myapp", "dir": "/abs/path/to/root/cmd/myapp"}
  ],
  "project": {
    "name": "myapp",
    "version": "v1.2.3",
    "description": "Example CLI tool"
  }
}
```

**Contract guarantees at version 1:**

- `version` is always present — consumers check it before parsing. CLI tools that emit JSON version their output (`docker inspect`, `terraform state`, `kubectl get -o json`). Same pattern.
- `root` is always present, has `path`, `dir`, `goVersion`
- `subs` is an array (may be empty)
- `dir` is absolute path — pipe consumers don't know the caller's cwd
- `requires` lists only modules discovered within the project (inter-module dependencies). Third-party `require` directives from `go.mod` (e.g. `go.opentelemetry.io/otel`) are not included — they are not gover's concern
- `releasable` — omitted when `true` (default). Present as `false` for workspace-only modules (`_` prefix). Consumers treat absent field as `true`.
- Fields may be added in future versions — consumers must ignore unknown fields (forward compatibility)

**Amendment (RFC-003):** `"releasable": false` replaces RFC-001's `"workspace_only": true`. Consumer-oriented: answers "can I expect a tag for this module?" directly. Derived from `_` prefix convention, but explicit in the contract — consumers should not need to know the convention.

### Full Pipeline Example

```bash
# CI release pipeline — library (no binaries)
VERSION=$(gover bump)
[ -z "$VERSION" ] && echo "No release needed" && exit 0
gover release "$VERSION" --write --push
gover notes "$VERSION" | gh release create "$VERSION" -F -
```

```bash
# CI release pipeline — CLI tool (with binaries)
VERSION=$(gover bump)
[ -z "$VERSION" ] && echo "No release needed" && exit 0
gover release "$VERSION" --write --push
gover build
gover notes "$VERSION" | gh release create "$VERSION" dist/* -F -
```

For projects that want pre-publish analysis before the point of no return:

```bash
VERSION=$(gover bump)
[ -z "$VERSION" ] && exit 0

# Prepare — staging worktree created, tags created locally
gover release "$VERSION" --write

# Analyze in staging worktree
cd .gover/staging
govulncheck ./... && GOWORK=off go build ./...
RESULT=$?
cd ../..

# Ship or abort
if [ $RESULT -eq 0 ]; then
  gover release --push
  gover build
  gover notes "$VERSION" | gh release create "$VERSION" dist/* -F -
else
  gover release --abort
fi
```

### Version String (gover bump → gover release)

Stdout, one line, semver with `v` prefix: `v1.2.3`. Empty stdout = no release needed.

### Release Notes (gover notes → platform CLI)

Stdout, markdown. Designed for piping:

```bash
gover notes v1.2.3 | gh release create v1.2.3 -F -
gover notes v1.2.3 > RELEASE_NOTES.md
```

### Exit Codes

All subcommands follow Unix convention:

- `0` — success (or "no action needed" for bump)
- `1` — error (message on stderr)

### IO Convention

- **stdout** — structured output (JSON, version string, markdown). Reserved for pipe.
- **stderr** — human-readable logs, progress, errors. Tools use `slog` with component tag.

---

## CLI Surface

```
gover                                  # discovery + apply dev-state (go.work + replaces)
gover model                            # full project model as JSON
gover go <args>                        # Go command proxy with per-module iteration
gover bump                             # next version from conventional commits
gover bump --major                     # force major bump
gover release <version>                # dry-run: show plan
gover release <version> --write        # prepare: staging worktree + tags locally
gover release <version> --write --push # prepare + ship in one step
gover release --push                   # ship prepared release
gover release --abort                  # rollback prepared release
gover build                            # cross-compile + archive + checksum → dist/
gover notes <version>                  # release notes as markdown
```

**Root detection:** `cwd = project root`. No upward search. Like goreleaser, terraform. If `go.mod` not found in cwd — error with actionable message.

**NoGit warning:** If `.git` not found — warning, not error. Covers shallow clone, CI misconfiguration. Actionable error messages replace the need for a separate `doctor` command.

