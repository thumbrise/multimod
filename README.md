# gover

[![CI](https://github.com/thumbrise/gover/actions/workflows/ci.yml/badge.svg)](https://github.com/thumbrise/gover/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](/LICENSE)

*Composable governance CLI for Go projects.*

Version determination, release notes, cross-compilation, pre-publish staging, dev-state sync. For single-module and multi-module projects. No YAML DSL. No monolithic pipeline. No paywall on composable features. Unix-way subcommands, structured stdout, every step replaceable.

> **Work in progress.** Architecture under active RFC development — stress-tested through adversarial review. Previously named `multimod` — renamed to `gover` after scope expansion.

## Do you need this?

**Library?** `gover bump` → `gover release --write --push` → `gover notes | gh release create`. Tags, publish-state, release notes.


**CLI tool?** Add `gover build` for cross-compile + archive + checksum. Full pipeline.


**Multi-module?** `gover` (root command) syncs `go.work`, replace directives, Go version. Then everything above.

## Quick Start

```bash
go install github.com/thumbrise/gover@latest
gover
```

One command. After this: `go.work` is correct, `replace` directives are in place, Go version is aligned, IDE works, `go test ./...` covers all modules. Run it again — nothing changes. Idempotent.

## Documentation

**[thumbrise.github.io/gover](https://thumbrise.github.io/gover/)** — getting started, RFC, devlog.

- [Getting Started](https://thumbrise.github.io/gover/guide/getting-started) — install, first sync
- [Reference](https://thumbrise.github.io/gover/reference/) — RFCs: architecture, design decisions, disputed points
- [Devlog](https://thumbrise.github.io/gover/devlog/) — design decisions, dead ends, lessons learned

## Origin

Born inside [thumbrise/resilience](https://github.com/thumbrise/resilience). [Read the full story.](https://thumbrise.github.io/gover/devlog/001-the-great-migration)

## License

Apache 2.0