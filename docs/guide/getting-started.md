---
title: "Getting Started — Go Release Automation Without the Monolith"
description: "Composable Go release pipeline: version bump from conventional commits, cross-compile + archive + checksum, pre-publish staging, release notes. For single-module and multi-module projects. goreleaser alternative, semantic-release replacement."
head:
  - - meta
    - name: keywords
      content: go release automation, goreleaser alternative, semantic-release go, go cross compile multiple platforms, go changelog conventional commits, go module release automation, cargo-release for go, multiple go.mod one repo, go.work doesn't work, go.work keeps breaking, go mod replace not working, go test multiple modules, go release multiple modules, go tag submodule, go.work vendor testdata, go.work breaks IDE, go mod tidy multiple modules
---

# Getting Started

::: warning Work In Progress
gover is in active development. The [RFC](/reference/) is the architectural source of truth. Not production-ready for general use yet.
:::

## What is gover

Composable release pipeline for Go projects. Each step is a subcommand. Each subcommand is replaceable.

```bash
go install github.com/thumbrise/gover@latest
```

## What's your project?

**Library** — bump version, tag, generate release notes:

```bash
gover bump                                        # → v1.2.3
gover release v1.2.3 --write --push               # tag + publish-state
gover notes v1.2.3 | gh release create v1.2.3 -F -  # release notes → GitHub
```

**CLI tool** — same as library, plus cross-compile:

```bash
gover build                                       # multi-platform, tar.gz/zip, checksums

gover notes v1.2.3 | gh release create v1.2.3 dist/* -F -
```

**Multi-module** (multiple `go.mod` in one repo) — same as above, plus dev-state sync:

```bash
gover                                             # go.work + replaces + go version sync
```

One command. After this: `go.work` is correct, `replace` directives are in place, Go version is aligned, IDE works, `go test ./...` covers all modules. Run it again — nothing changes. Idempotent.

## Why not GoReleaser / semantic-release

| Problem                                    | GoReleaser                  | semantic-release              | gover                                  |
|--------------------------------------------|-----------------------------|-------------------------------|-----------------------------------------|
| Build without publishing                   | `--skip=publish` (partial)  | Not possible                  | `--write` (staging worktree)            |
| Prepare/publish separation                 | **Pro only** (paid)         | Not possible                  | `--write` / `--push` / `--abort`        |
| "Will there be a release?" (machine-readable) | No                       | No (`--dry-run` = text only)  | `gover bump` → stdout or empty          |
| Multi-module Go (`go.mod` × N)             | **Pro only** (paid)         | Breaks (tags main = dev-state)| Built-in (prefix tags, replace strip)   |
| Replace any step with your own tool        | No (monolithic pipeline)    | Plugin system (Node.js)       | Yes (stdin/stdout, pipe anything)       |
| Config format                              | `.goreleaser.yml` (500+ options) | `.releaserc.js` (JS + plugins) | `.gover/release.toml` (open, portable) |

Not competition — different architecture. gover handles governance (tags, publish-state, model). GoReleaser handles distribution (Docker, Homebrew, Snap). They can work together.

## Pre-publish staging — Go's missing `npm pack`

Go Module Proxy caches forever. Push a tag with broken `go.mod` — permanent. No undo. No `npm unpublish`. No `cargo yank`.

`gover release --write` creates a staging worktree with publish-state. Check before you push. `--push` ships. `--abort` rolls back.

```bash
gover release v1.2.3 --write        # staging worktree, tags local only
cd .gover/staging && go build ./...  # verify publish-state builds
gover release --push                 # ship — or --abort to roll back
```

## What you get for multi-module projects

<details>
<summary><strong>Multiple go.mod files? go.work keeps breaking? Expand this.</strong></summary>

### Monorepo or multi-module project?

|               | Monorepo                                | Multi-module project                      |
|---------------|-----------------------------------------|-------------------------------------------|
| **What**      | Storage strategy                        | Architecture strategy                     |
| **Structure** | Many independent projects, one Git repo | One product, many Go modules              |
| **Example**   | 15 microservices in one repo            | Core library + OTEL/gRPC/Redis extensions |
| **Release**   | Each project has its own version        | All modules share one version             |
| **Tool**      | Bazel, Nx, Turborepo                    | gover                                     |

### What gover does over raw `go.work`

`go.work` is a mechanism. gover is the policy layer on top.

- **Filtered discovery** — `go work use -r .` picks up `vendor/`, `testdata/`, broken test fixtures. gover doesn't. Verified go.work footguns [cataloged in the RFC](/reference/).
- **Replace management** — unconditional `replace` directives for all internal modules. `go mod tidy` resolves locally. No manual bookkeeping.
- **Go version sync** — root's `go` directive propagated to all sub-modules. No silent drift.
- **Acyclic validation** — cyclic dependencies caught at dev-time, not at release-time.

### Two states of `go.mod`

Every sub-module's `go.mod` exists in exactly two states. gover formally separates them.

|           | Dev-state (main branch)           | Publish-state (behind tag)        |
|-----------|-----------------------------------|-----------------------------------|
| `replace` | `replace example.com/root => ../` | **Removed**                       |
| `require` | `require example.com/root v0.0.0` | `require example.com/root v1.2.3` |
| Who sees  | Developers                        | Users (`go get`)                  |

Main branch is the **kitchen** — `replace` directives, `go.work`, version placeholders. All committed. All managed by gover. Users never see this.

The tag points to a **detached commit** — clean `go.mod`, no replaces, pinned versions. What `go get @v1.2.3` downloads. The commit is not on any branch. Main never leaves dev-state.

</details>

## What's Next

- [Reference](/reference/) — architectural source of truth: problem statement, evidence base, disputed points, full decision log
- [Devlog](/devlog/) — design decisions, dead ends, lessons learned
