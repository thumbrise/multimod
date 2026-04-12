---
title: "multimod Devlog #1 — The Great Migration"
description: "How a Go multi-module management tool was born inside a fault tolerance library, outgrew its parent, and became a standalone unix-way CLI ecosystem. The full story of tools that birth tools."
head:
  - - meta
    - name: keywords
      content: go multi-module tool extraction, golang monorepo tool, multimod origin story, go tooling born from pain, cargo-release for go, open source tool extraction
---

# #1 — The Great Migration

> "The tool that manages modules finally got its own module."

## The Prehistory

multimod was never planned.

It started as a shell script inside [thumbrise/resilience](https://github.com/thumbrise/resilience) — a fault tolerance library for Go. resilience needed multi-module support: zero-dependency core, OTEL plugin in a separate `go.mod` so users don't pull the SDK unless they want it. Simple requirement.

The shell script grew. 20 lines of grep over JSON inside YAML. Then it broke — added a self-dependency to every module because grep matched `Module.Path` in `go mod edit -json` output. Classic.

We looked around. Rust has `cargo-release`. Node has `changesets`. Java has `mvn release`. Go has... nothing. The full research, the ecosystem survey, the design decisions, the three failed architectures, the adversarial review that stress-tested the RFC — all of that is documented in the [resilience devlog](https://thumbrise.github.io/resilience/devlog/).

What matters here is the conclusion: the gap is real, nobody fills it, we're building it.

## The Deathbook

There's a pattern we keep seeing. Tools emerge from tools. Problems birth solutions that birth new problems that birth new solutions. We call it the deathbook — a ledger where every GAP gets an entry, and every entry eventually gets crossed out.

| # | GAP | Born inside | Status | Primitive |
|---|-----|-------------|--------|-----------|
| 1 | Resilience patterns in Go | autosolve | ✅ Extracted → `thumbrise/resilience` | `func(ctx, call) error` |
| 2 | Task runner lifecycle hooks | resilience | 📝 Documented, waiting | `BeforeAll` / phases |
| 3 | Multi-module management | resilience | ✅ Extracted → `thumbrise/multimod` | `Discovery → State → Applier` |
| 4 | Version bumping from commits | multimod | 🔮 Planned | `version-bumper` |
| 5 | GitHub Release creation | multimod | 🔮 Planned | `ghreleaser` |

Each entry follows the same script: concrete pain → honest research → minimal primitive → extract when ready.

resilience was born inside autosolve (a GitHub automation daemon). It outgrew its parent and became a standalone library. Now multimod — born inside resilience — outgrew *its* parent. The deathbook gets thicker. The pattern repeats.

## What We Brought

The migration isn't a rewrite. It's a transplant. The code, the architecture, the RFC — all of it moves intact. Here's what multimod brings to its new home:

**The Architecture:**
```
Boot → Discovery → desired State → Applier
```

Three rewrites in one day led to this. Issue/Fixer/Runner → Rule/Op/Applier → Discovery/State/Applier. The breakthrough: why compute a diff when you can declare desired state? Terraform thinking killed the diff-based approach and gave us something simpler and more powerful.

**The RFC:**

[RFC-001](/reference/rfc-001-ecosystem) — born from a three-round adversarial architecture review. Skeptic, Implementor, Arbiter. Six rounds of debate. Eight decisions. Ten known limitations. Zero hand-waving. The detached commit model survived every attack. semantic-release was proven fundamentally incompatible (not "hard to configure" — incompatible). The `workspace_only` field was added to the JSON contract because the Skeptic found a real convention leak.

This is the most current document in the entire project. When in doubt — read the RFC.

**The Ecosystem Vision:**

Not one tool — four. Each does one thing. Unix pipes between them:

```bash
multimod modules | multirelease $(version-bumper) --write --push
```

`multimod` guards dev-state. `multirelease` creates publish-state. `version-bumper` determines the version. `ghreleaser` creates the GitHub Release. Any tool is replaceable with a shell script or third-party alternative. The contracts between them matter more than the implementations.

**The Dog-Fooding:**

multimod manages itself. The repository is a multi-module Go monorepo (`multimod/`, `multirelease/`, `_tools/`) managed by its own tool. `go run ./multimod go test ./...` runs tests across all modules. If multimod can't manage multimod — it's broken.

## What Changes

The old home was `pkg/multimod/` inside resilience. The new home is `github.com/thumbrise/multimod` — a standalone repository with its own lifecycle.

What this means:

- **Independent versioning.** multimod releases don't wait for resilience releases.
- **Independent CI.** multimod tests don't run resilience tests.
- **Independent contributors.** You don't need to understand fault tolerance to contribute to a monorepo tool.
- **Own bounded context.** The docs, the RFC, the devlog — all scoped to multimod's domain.

What doesn't change: the architecture, the RFC, the design principles, the code. A transplant, not a rewrite.

## Honest Status

Let's be clear about where we are:

- **RFC-001** — solid. Three-round adversarial review. Eight decisions. Ten known limitations documented honestly.
- **multimod** (dev-state guardian) — proof of concept. Discovery, applier, go proxy work. Dog-fooding on itself.
- **multirelease** (publish-state creator) — proof of concept. Reads JSON, transforms go.mod, creates detached commit + tags.
- **version-bumper** — planned. Not started.
- **ghreleaser** — planned. Not started. May just be `gh release create`.

This is not production-ready software. This is an RFC-driven project building proofs of concept. The architecture is proven. The implementation is catching up.

## What's Ahead

The deathbook has open entries. version-bumper and ghreleaser are planned but not built. The pipe ecosystem works end-to-end for the happy path, but edge cases remain (rollback on failed push, selective module release, toolchain directive sync).

The [RFC](/reference/) documents ten known limitations honestly. The ~~FAQ~~ (deleted, merged into RFC §7) answered every angry question we could think of. The ~~spec~~ (deleted, merged into RFC) described what existed at the time.

This is the starting line, not the finish line. But the foundation is solid — battle-tested inside resilience, stress-tested by adversarial review, and now running in its own home.

## The Pattern

Tools emerge from tools. ClickHouse from Yandex internals. MapReduce from Google's data processing. resilience from autosolve's retry needs. multimod from resilience's release needs.

The deathbook grows. The GAPs get crossed out. The ecosystem gets thicker.

Because the only honest response to "there's no tool for this" is to build one. And when the tool outgrows its parent — you let it go.

---

*The tool that outgrew its parent. Again.*
