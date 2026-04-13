---
title: "multimod Devlog #3 — When go.work Doesn't Go Work"
description: "20 documented go.work problems and how to solve them. go.work picks up vendor and testdata, breaks IDE, silently changes builds. Why go.work alone is not enough for multiple go.mod files."
head:
  - - meta
    - name: keywords
      content: go.work doesn't work, go.work problems, go.work not working, go.work breaks build, go.work vendor testdata, go.work IDE broken, multiple go.mod problems, go mod replace keeps breaking, go.work too complex, go release multiple modules
---

# #3 — When go.work Doesn't Go Work

> "Not a release tool. A governance layer."

## The Trigger

RFC-002 was 882 lines. Solid. 21 disputed points survived adversarial review. 16 decisions in the log. We thought we were done with the spec.

Then we started cataloging go.work footguns.

Not hypothetical problems. Real issues from the Go issue tracker. Real frustration from real projects. `go work use -r .` picks up `vendor/` and `testdata/` and malformed test fixtures — creating an unusable workspace. Phantom `go.work` from parent directories silently changes your build. `GOWORK` env variable overrides everything without telling you. `govulncheck` doesn't work in workspace mode. `golangci-lint` goes silent. `go.work.sum` auto-updates and masks `go.sum` errors.

20 verified public sources. Each one a footgun. Each one something multimod already solves or can solve.

That's when the positioning shifted.

## "Release Tool" Was Wrong

RFC-001 called multimod "the missing `cargo-release` for Go." RFC-002 kept that framing. But the evidence base told a different story.

Most of the value multimod provides has nothing to do with releases. Workspace sync. Replace management. Go version alignment. Filtered discovery that doesn't pick up garbage. Acyclic dependency validation. These are dev-time capabilities. They matter whether you ever run `multimod release` or not.

multimod is not a release tool that happens to manage workspaces. It's a governance layer that happens to support releases.

The analogy that clicked: main branch is the kitchen, not the restaurant floor. Replace directives are committed. `go.work` is committed. Both are dev-state artifacts. Neither leaks to consumers. After `git clone`, everything works. Zero setup. multimod is the chef who keeps the kitchen clean — not the waiter who serves the plates.

## go.work Is a Managed Artifact

This was the hardest mental shift. The Go team says don't commit `go.work`. We say commit it — but don't touch it.

multimod generates `go.work`. multimod overwrites `go.work`. multimod owns `go.work`. Your edits will be lost on the next run. And that's the point.

`go.work` exists in the repo so that after `git clone` everything works: IDE sees all modules, `go test ./...` covers everything. That's its only job. multimod handles the rest.

The core dev-state mechanism is replace directives, not `go.work`. Replace directives in `go.mod` ensure that `go mod tidy` resolves internal modules locally. `go.work` provides additional benefits — IDE cross-module navigation, workspace-aware test execution — but it's not required for correctness. It's cherry on top.

## Policy vs Mechanism

This distinction crystallized during a design session. `go work` is a mechanism — it provides the ability to substitute a module locally. multimod is policy — it decides when and for whom that ability should be active.

The Go team intentionally left policy out of scope. They gave us `use` and `replace`, but not `go work enable` or `go work release`. Because every project has its own CI/CD and its own git flow.

multimod fills that vacuum. We don't compete with `go work`. We govern what `go work` cannot: conventions, validation, per-module operations, and safe `go.work` lifecycle.

## Monorepo ≠ Multi-Module Project

A 2021 Hacker News thread captured the confusion perfectly. One commenter says "Modules are not for monorepos" — then admits "this requires tooling around your monorepo." Another suggests Bazel. A third gives up entirely.

They were all talking past each other because they conflated two orthogonal concepts. A monorepo is a storage strategy — one git repo, many projects. A multi-module project is an architecture strategy — one product, many Go modules.

Bazel solves monorepo problems (build orchestration). multimod solves multi-module problems (module governance). They don't compete. They don't even overlap.

We fixed the terminology everywhere. ~21 replacements across ~15 files. "monorepo" → "multi-module project" except where explaining the difference.

## 30 Disputed Points

RFC-003 has 30 disputed points. Not 30 questions — 30 attacks on the architecture, each with challenge, resolution, and concessions.

From three adversarial reviews:
- **RFC-001 review** (Skeptic, Implementor, Arbiter) — pipe-ecosystem hypocrisy, semantic-release decomposition, JSON vendor lock-in, zero-config scaling, detached commit hack, Go toolchain competition, govulncheck blocking.
- **RFC-002 review** (Critic, Implementor, Arbiter) — single binary failure domain, git worktree CI persistence, local tags triggering webhooks, dog-fooding credibility, acyclic validation black box, cwd-is-root, unconditional replaces, committed go.work, committed replace directives, -dev tag imports, renamed modules, shallow clone traps, root depending on subs.
- **RFC-003 design session** — graph validation as dev vs release value, go.work necessity, GOWORK=off absolutism, Bazel as alternative, multimod doctor, --isolated flag, nested sub-modules, 500-module scaling, classifier rework, evidence verification, selective release rejection, IDE replace vs go.work, workspace-only modules.

Each one is a court record. Challenge, defense, verdict. The process matters more than the outcome. A decision without its debate record is an assertion without proof.

## Named Sections

RFC-003 dropped section numbers. No more "§7.4" — just "Zero-config doesn't scale to 40+ modules" with an anchor link. Go proposal style.

Why: sections can be added without cascade renumbering. Cross-references are stable — they point to names, not positions. And names are searchable in a way that "§7.4" never will be.

## Append-Only Court Record

We added rules to the RFC header. Content is never deleted — only superseded with strikethrough. Disputed Points, Decision Log, and Amendment History are sacred. "Simplify" means fix typos and improve clarity. It does not mean delete court records.

These rules exist because we learned the hard way: an RFC that loses its disputed points loses its credibility. The decisions remain, but nobody knows why they were made. Never again.

## What's Next

The spec is solid. 1100 lines. 30 disputed points. 24 decisions. 20 evidence links. 11 known limitations. Full amendment history with adversarial review summaries.

Now the implementation catches up. The classifier needs rework (D19 — test/vet/build don't need iteration). The JSON contract needs `"releasable": false` (D20). The release pipeline needs validate-before-commit (§5.5).

And somewhere on the horizon — a Go proposal. Not today. First: awesome-go. First: real users. First: every edge case found and fixed. The spec will be the proof. The tool will be the evidence.

---

*When `go.work` doesn't go work — multimod does.*
