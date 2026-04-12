---
title: "Getting Started — Go Multi-Module Project Tooling"
description: "You searched for a Go monorepo tool. But do you actually have a monorepo problem — or a multi-module problem? multimod solves the second one. Zero config. The missing cargo-release for Go."
head:
  - - meta
    - name: keywords
      content: go monorepo tool, go multi-module getting started, golang monorepo setup, go.work sync tool, go mod replace automation, multimod install, zero-config go monorepo, cargo-release for go
---

# Getting Started

::: warning Work In Progress
multimod is in active development. The [RFC](/reference/rfc-003-ecosystem) is the architectural source of truth. Not production-ready for general use yet.
:::

## Wait — do you need a monorepo tool?

You probably searched for "Go monorepo tool." Let's check if that's actually what you need.

**Do you have this?**
- One Git repo with multiple `go.mod` files
- A core library + optional extensions (OTEL, gRPC, Redis) in separate modules
- `go.work` that keeps breaking, `replace` directives everywhere, `go mod tidy` that must run per-module
- Release day means stripping replaces, pinning versions, tagging each sub-module by hand

**If yes — you don't have a monorepo problem. You have a multi-module problem.**

A monorepo is a storage strategy: 15 microservices in one Git repo. You need Bazel, Nx, or Turborepo — tools that decide **which projects to build**.

A multi-module project is an architecture strategy: one product, many Go modules. You need a tool that manages **how those modules work together** — workspace sync, replace directives, version alignment, coordinated releases.

These are orthogonal problems. Different tools. multimod solves the second one.

::: tip Still not sure?
Quick test: do all your modules share one version number at release time? If yes — multi-module project, you're in the right place. If each module has its own independent version — that's a monorepo with independent packages, and multimod is not for you.
:::

## Quick Start

```bash
# From your project root (where root go.mod lives):
go run github.com/thumbrise/multimod@latest
```

That's it. One command. After this:
- `go.work` is generated — IDE sees all modules, cross-module navigation works
- `replace` directives are in place — `go mod tidy` resolves internal modules locally, not from registry
- Go version is aligned across all modules — no silent drift
- `go test ./...` works across all modules (Go workspace mode)

Run it again — nothing changes. Idempotent.

**What multimod gives you that `go.work` alone doesn't:** numerous documented go.work footguns handled. `go work use -r .` picks up `vendor/`, `testdata/`, broken test fixtures — multimod doesn't. Replace directives managed automatically. Go version synced. On release day — `multimod release` strips replaces, pins versions, tags every sub-module. No shell scripts.

## What's Next

The [Reference](/reference/) section contains the architectural source of truth — RFCs covering problem statement, design decisions, capabilities, and disputed points.
