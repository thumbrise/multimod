# multimod

[![CI](https://github.com/thumbrise/multimod/actions/workflows/ci.yml/badge.svg)](https://github.com/thumbrise/multimod/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](/LICENSE)

The missing `cargo-release` for Go.

Zero-config CLI for Go multi-module monorepos. Workspace sync, replace management, detached-commit releases, sub-module tagging. No YAML. No shell scripts. Just `go.mod`.

> **Work in progress.** The RFC is solid — stress-tested through adversarial architecture review. The implementation is catching up.

## Do you need this?

Do you have a Go project with multiple `go.mod` files in one repo — a core library plus optional extensions (OTEL, gRPC, Redis) in separate modules?

If yes — you have a **multi-module project**, not a monorepo. Different problem, different tool. multimod solves this one.

## Quick Start

```bash
# Sync everything: go.work, replace directives, go version alignment
go run github.com/thumbrise/multimod@latest

# Test all modules
go run github.com/thumbrise/multimod@latest go test ./...
```

One command. Zero config. Idempotent. Run it again — nothing changes.

## Documentation

**[thumbrise.github.io/multimod](https://thumbrise.github.io/multimod/)** — getting started, RFC, devlog.

- [Getting Started](https://thumbrise.github.io/multimod/guide/getting-started) — install, first sync, the monorepo vs multi-module distinction
- [Reference](https://thumbrise.github.io/multimod/reference/) — RFCs: architecture, design decisions, disputed points
- [Devlog](https://thumbrise.github.io/multimod/devlog/) — design decisions, dead ends, lessons learned

## Origin

Born inside [thumbrise/resilience](https://github.com/thumbrise/resilience) — a fault tolerance library for Go that needed multi-module support. The shell scripts grew, broke, and got replaced with a tool. The tool outgrew its parent. [Read the full story.](https://thumbrise.github.io/multimod/devlog/001-the-great-migration)

## License

Apache 2.0