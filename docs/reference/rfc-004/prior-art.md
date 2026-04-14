---
title: "RFC-004 — Prior Art & Analysis"
---

---

## Prior Art & Analysis

### OTEL Go multimod (opentelemetry-go-build-tools)

The largest public Go multi-module project (~40 modules) built their own tool also called `multimod` (`go.opentelemetry.io/build-tools/multimod`). The name collision is coincidental — the tools share a problem domain but differ fundamentally in approach **[E8]**.

**OTEL multimod:** config-driven. Requires `versions.yaml` that groups modules into named sets (stable-v1, experimental-metrics, bridge), each with a version number. Three CLI commands: `verify` (validate YAML), `prerelease` (update go.mod files, create branch + commit), `tag` (create git tags). Written in Go with Cobra. Tied to OTEL conventions.

**gover:** convention-driven. Zero config files by default. Auto-discovers modules from filesystem. Manages go.work, replace directives, go version sync. Release via subcommand with detached commit model. Version determination and release notes as built-in subcommands.

|                       | OTEL multimod                  | gover                                    |
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

### semantic-release

The dominant release automation tool (Node ecosystem, used in Go via npx). Analyzes conventional commits, determines semver bump, creates tags and GitHub Releases.

**Fundamental incompatibility with multi-module Go:** semantic-release tags the current branch (main). In a multi-module project, main is in dev-state — `go.mod` files contain `replace ../` directives. Users who `go get @v1.2.3` receive broken go.mod. Additionally, semantic-release uses `git tag --merged` to find previous versions. Detached commits (our release model) are not reachable from main — the version chain breaks.

**Confirmed through adversarial review:** this is not a plugin/configuration issue. It is a fundamental architectural mismatch. The Node ecosystem reached the same conclusion — `changesets` replaced semantic-release for monorepo use cases (Vercel, Chakra UI, Radix).

**New findings (RFC-004):** No machine-readable dry-run. `--dry-run` outputs text to console — no JSON, no exit code. The only community "solution": `@semantic-release/exec` plugin with `node -e` running `child_process.execSync` running `git log` with `grep` — inside a JSON config string. A shell command inside Node inside a plugin inside a dry-run. To answer "yes or no." No prepare/publish separation — not even paid. All or nothing.

### go-semantic-release v2 (RFC-004)

Go-native reimplementation of semantic-release. 313 stars, MIT, active. Separate project from `Nightapes/go-semantic-release` (earlier, less active fork).

**What it does:** conventional commits → version → changelog → GitHub/GitLab Release. Plugin system for extensibility.

**What it doesn't do:** no machine-readable dry-run (same limitation as Node original). No prepare/publish separation. No multi-module support. No structured JSON output of version decision. Same fundamental architecture as Node semantic-release — monolithic, all-or-nothing.

**Classification:** Go-native monolith. Solves the Node.js dependency problem but not the architectural problem.

### goreleaser

Builds and publishes Go binaries. The dominant tool in Go ecosystem for binary distribution. ~50k stars.

**What it does well:** cross-compile, archive, checksum, Docker images, Homebrew taps, Scoop, Snap, Chocolatey, GPG signing, SBOM generation. Massive ecosystem of integrations.

**What it doesn't do:** does not understand Go modules, replace directives, or multi-module workspaces. Does not provide publish-state creation, staging area, or dev-state governance.

**Architectural problems discovered in practice (ghset PRs #20, #23):**
- `mode: keep-existing` silently skips binary uploads when another tool creates GitHub Release first.
- Default `name_template` includes version in filenames, breaking install scripts expecting stable names.
- Runs unconditionally — crashes on missing tags when there's nothing to release.
- `--skip=publish` exists but is an afterthought — skip one step in a monolithic pipeline. No staging area, no abort, no rollback.
- `--prepare` / `--publish` separation — **Pro only** (paid, since July 2022).
- Monorepo support — **Pro only**.
- Proprietary YAML config (500+ options). Change tools — rewrite config.

**Classification:** binary distribution monolith. Excellent at what it does, but conflates build + archive + publish into one pipeline with no composable boundaries.

### uplift (RFC-004)

Automated semver bumping and changelog generation. 38 stars, MIT, **dead** (last commit 2+ years ago).

**Notable:** has `--no-push` flag — direct analog of gover's `--write`. Prepare locally, don't push. Independently discovered pattern. But no `--abort`, no multi-module, no JSON output, no staging worktree.

**Classification:** dead project that independently confirmed the prepare/publish separation pattern.

### release-please (Google) (RFC-004)

Automated releases via GitHub PRs. ~5.5k stars, Apache-2.0, actively maintained by Google.

**How it works:** analyzes conventional commits, creates a PR with version bumps and changelog. Merging the PR triggers the release. PR-based workflow, not CLI-based.

**Limitations:** GitHub Actions only. PR-based — no detached commits, no staging worktree, no CLI pipe. Multi-module Go requires manual manifest configuration. Not composable — it IS the pipeline, not a step in one.

**Classification:** platform-specific release automation. Different paradigm (PR-based vs CLI-based). Not composable.

### svu, cocogitto, git-cliff

Unix-way CLI tools for version management and changelog generation. `svu` — semver from git tags. `cocogitto` — conventional commits analysis. `git-cliff` — changelog generation. Each does one thing. Composable through stdout. These validate the problem space but do not solve the multi-module lifecycle.

### gommitizen (RFC-004)

Language-agnostic conventional commits tool. 8 stars. Works with version files (`.version`, `package.json`), not Go modules. Bumps version, generates changelog, creates git tag.

**What it doesn't do:** no Go module awareness, no replace directives, no publish-state, no multi-module, no JSON output. Version lives in a file, not in git tags — different model from Go's tag-based versioning.

**Classification:** language-agnostic version file bumper. Solves a different problem (version file management) with a different model (file-based, not tag-based).

### kimono (bonzai)

Part of the bonzai CLI framework by rwxrob. Provides `work` (toggle go.work), `tidy` (go mod tidy across modules), `tag` (prefix-based tagging), `deps`/`dependents` (dependency analysis). Auto-discovers modules via filesystem walk.

**What it does well:** dev-time convenience — toggling workspace, running tidy across modules.

**What it doesn't do:** no replace management, no go version sync, no release transforms (strip replaces, pin requires), no detached commit, no JSON output, no publish-state validation. Tags current HEAD directly.

**Classification:** dev convenience tool, not a release tool.

### monorel (The Root Company)

Automates releases for individual modules in a monorepo. Generates `.goreleaser.yaml`, computes next version from git log, creates prefix tags (`cmd/tool/v1.0.0`), publishes via goreleaser + gh.

**What it does well:** binary release automation with per-module version tracking.

**What it doesn't do:** no replace management, no go.work sync, no publish-state transforms. Tightly coupled to goreleaser — designed for binaries, not libraries. No JSON output.

**Classification:** binary release tool, not a library release tool.

### Crosslink (OTEL build-tools)

Part of OTEL's build toolchain (`go.opentelemetry.io/build-tools/crosslink`). Scans modules and inserts `replace` directives for intra-repository dependencies. Can generate `go.work`. Supports `prune` for stale replaces.

**Limitations:** requires `--root` flag or git-based root detection (not fully auto-discovery). Works only within one module namespace. Does not sync `go version`. No JSON output, not pipe-friendly. Tied to OTEL conventions.

**Classification:** partial dev-state tool — covers replace sync but not the full lifecycle.

### Gorepomod (Kustomize/SIG)

Tool for multi-module repos in Kubernetes ecosystem (`sigs.k8s.io/kustomize/cmd/gorepomod`). Commands: `pin` (remove replaces, fix versions for publish), `unpin` (add replaces for dev), `release` (compute version, create release branch, tag, push).

**Key insight:** `pin`/`unpin` is the same two-state model as our dev-state/publish-state — different names, same concept. Confirms the pattern is real and independently discovered.

**Limitations:** uses release branches, not detached commits — mixes dev-state and publish-state on the same branch during hotfix. Tied to Kustomize structure. Last release 6+ years ago — effectively unmaintained. No JSON output.

**Classification:** partial release tool with correct model but abandoned implementation.

### Go toolchain (`go work`, `go mod`)

`go work` manages workspace. `go mod tidy` syncs dependencies. But:

- `go work use -r .` has no filtering — picks up `vendor/`, `testdata/`, and malformed test fixtures **[E12]**
- `go work` does not manage replace directives in `go.mod`
- `go mod tidy` does not sync Go version across modules
- `go mod tidy` operates per-module only — no workspace-level equivalent
- `go work sync` synchronizes dependency versions across modules but does not replace `go mod tidy`
- Neither knows about releases
- `go.work` introduces numerous documented footguns (see [Problem Statement](./#problem-statement) point 7, [go.work Specific Footguns](./evidence.md#go-work-specific-footguns-rfc-003-verified))

**Key discovery (RFC-003):** Go workspace mode (Go 1.18+) makes `go test ./...`, `go vet ./...`, and `go build ./...` work across all modules in the workspace. This eliminates the need for per-module iteration of these commands. However, `go mod tidy`, `go tool <name> ./...` for broken tools, and architectural validation remain unsolved.

The tool complements Go toolchain, not competes with it. gover does not re-implement what `go work` already does — it governs what `go work` cannot: conventions, validation, per-module operations, and safe go.work lifecycle.

**Go proposals for optional dependencies:** issue [#44550](https://github.com/golang/go/issues/44550) (2019) proposed optional dependencies in `go.mod` — not implemented. Issue [#47034](https://github.com/golang/go/issues/47034) (2021) proposed optional mode for semantic import versioning — not implemented. The Go team is aware of the problem but has not prioritized it. Until they do, the gap remains.

### Bazel

Mentioned in community discussions **[E9]** as a solution for monorepos. Bazel solves **build orchestration** — parallel, cached, incremental builds across languages. It does not solve **Go module governance**: replace directives, go.work generation, acyclic dependency validation, release transforms, sub-module tagging, publish-state creation. Even Bazel users who publish Go modules to the Go Module Proxy need go.mod management. gover and Bazel are orthogonal — different layers, different problems.

### Cargo Ecosystem — Reference Point (RFC-004)

Not a competitor — a reference point. Convergent design discovered post-factum. Same principles led to same architecture independently.

| Cargo                              | gover                          | Principle                              |
|------------------------------------|--------------------------------|----------------------------------------|
| `cargo build`                      | `gover build`                  | Build as separate operation            |
| `cargo package`                    | `gover release --write`        | Prepare locally, validate, don't publish |
| `cargo publish`                    | `gover release --push`         | Publish as explicit, separate step     |
| `cargo metadata --format-version 1`| `gover model --json`           | Structured project model on stdout     |
| `cargo-release`                    | `gover bump` + `gover release` | Versioning separate from distribution  |
| `cargo-dist`                       | `gover build`                  | Artifacts separate from versioning     |

**Key difference:** Cargo is a monolith — `cargo build` and `cargo publish` are tightly coupled, you can't replace `cargo build` with your own builder and still use `cargo publish`. gover is composable — don't like `gover build`? Use GoReleaser. Don't like `gover notes`? Use git-cliff. `gover model --json` — take the data and do whatever you want.

**Key similarity:** both separate preparation from publication. Both provide structured project metadata as JSON. Both version their output schemas. Both were designed through the same principles (composability, structured stdout, separation of concerns) without knowledge of each other.

`cargo-dist` (axodotdev) is particularly relevant: it handles cross-compilation + archiving + install scripts for Rust, separate from `cargo-release` which handles versioning. Same separation as gover build vs gover release. Apache-2.0/MIT dual license.

**What Cargo got right:** `cargo metadata` is the gold standard for project model as data. Every Rust CI tool consumes it. gover model aspires to the same role for Go.

**What Cargo got wrong (for our purposes):** monolithic. Can't swap components. Platform-locked to crates.io. gover is platform-agnostic by design (D15).

