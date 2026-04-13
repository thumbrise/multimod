---
title: "Getting Started — Go Multi-Module Project Tooling"
description: "Multiple go.mod files in one repo? go.work keeps breaking? replace directives everywhere? One command — workspace synced, replaces managed, versions aligned, releases tagged."
head:
  - - meta
    - name: keywords
      content: multiple go.mod one repo, go.work doesn't work, go.work keeps breaking, go.work too complex, go mod replace not working, go test multiple modules, go release multiple modules, go tag submodule, go.work vendor testdata, go.work breaks IDE, go mod tidy multiple modules
---

# Getting Started

::: warning Work In Progress
multimod is in active development. The [RFC](/reference/) is the architectural source of truth. Not production-ready for general use yet.
:::

<details>
<summary><strong>Monorepo or multi-module project? A checklist.</strong></summary>

Most developers search for "Go monorepo tool." These are different problems:

|               | Monorepo                                | Multi-module project                      |
|---------------|-----------------------------------------|-------------------------------------------|
| **What**      | Storage strategy                        | Architecture strategy                     |
| **Structure** | Many independent projects, one Git repo | One product, many Go modules              |
| **Example**   | 15 microservices in one repo            | Core library + OTEL/gRPC/Redis extensions |
| **Release**   | Each project has its own version        | All modules share one version             |
| **Tool**      | Bazel, Nx, Turborepo                    | **multimod**                              |

**Quick test:** do all your modules share one version number at release time?
- **Yes** → multi-module project. You're in the right place.
- **No** → monorepo with independent packages. multimod is not for you.

</details>

## Quick Start

```bash
# From your project root (where root go.mod lives):
go run github.com/thumbrise/multimod@latest
```

One command. After this:
- `go.work` is generated — IDE sees all modules, cross-module navigation works
- `replace` directives are in place — `go mod tidy` resolves internal modules locally, not from registry
- Go version is aligned across all modules — no silent drift
- `go test ./...` works across all modules (Go workspace mode)

Run it again — nothing changes. Idempotent.

## What You Get Over Raw `go.work`

`go.work` is a mechanism. multimod is the policy layer on top.

- **Filtered discovery** — `go work use -r .` picks up `vendor/`, `testdata/`, broken test fixtures. multimod doesn't. 20 verified go.work footguns [cataloged in the RFC](/reference/).
- **Replace management** — unconditional `replace` directives for all internal modules. Add a dependency, `go mod tidy` resolves locally. No manual bookkeeping.
- **Go version sync** — root's `go` directive propagated to all sub-modules. No silent drift.
- **Acyclic validation** — cyclic dependencies caught at dev-time, not at release-time when Go Module Proxy has already cached the broken version.

## Two States of `go.mod`

Every sub-module's `go.mod` exists in exactly two states. multimod is the only tool in the Go ecosystem that formally separates them.

|           | Dev-state (main branch)           | Publish-state (behind tag)        |
|-----------|-----------------------------------|-----------------------------------|
| `replace` | `replace example.com/root => ../` | **Removed**                       |
| `require` | `require example.com/root v0.0.0` | `require example.com/root v1.2.3` |
| Who sees  | Developers                        | Users (`go get`)                  |

Main branch is the **kitchen** — `replace` directives, `go.work`, version placeholders. All committed. All managed by multimod. Users never see this.

The tag points to a **detached commit** — clean `go.mod`, no replaces, pinned versions. This is the **restaurant floor** — what `go get @v1.2.3` downloads. The commit is not on any branch. Main never leaves dev-state.

```bash
# When you're ready to release:
multimod release v1.2.3 --write --push
```

One command: replaces stripped, versions pinned, every sub-module tagged (`otel/v1.2.3`, `grpc/v1.2.3`), detached commit created and pushed. Go Module Proxy caches it permanently — so multimod validates publish-state **before** the point of no return.

No other Go tool does this. The closest prior art — OTEL's 3000-line shell scripts — doesn't manage dev-state at all.

## What's Next

- [Reference](/reference/) — architectural source of truth: problem statement, evidence base, disputed points, full decision log
- [Devlog](/devlog/) — design decisions, dead ends, lessons learned
