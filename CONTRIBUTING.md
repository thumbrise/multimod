# Contributing

## Requirements

- **Go 1.26.x** — see `go.mod` for exact version.
- **[golangci-lint](https://golangci-lint.run/welcome/install/)** — install locally.
- **[Task](https://taskfile.dev/)** — task runner. Install: `go install github.com/go-task/task/v3/cmd/task@latest`
- **Node.js** (optional) — only for commitlint and docs build.

## First time setup

```bash
git clone https://github.com/thumbrise/multimod.git
cd multimod
go run ./multimod go test ./...
```

multimod manages itself (dog-fooding). The repo is a multi-module Go project with `multimod/`, `multirelease/`, and `_tools/` modules.

## Development workflow

```bash
# Run tests across all modules
go run ./multimod go test ./... -v

# Run lint (requires golangci-lint installed locally)
task lint

# Fix license headers
task generate
```

## Project structure

```
go.mod                 Root module (github.com/thumbrise/multimod)
go.work                Workspace: multimod + multirelease + _tools
multimod/              CLI binary #1 — dev-state guardian
multirelease/          CLI binary #2 — publish-state creator
_tools/                Dev tools: license-eye, govulncheck (workspace-only, not released)
docs/                  VitePress documentation site (RFC, spec, FAQ, devlog)
```

## Commit messages

Conventional commits. English only.

```
feat(discovery): add nested module support
fix(applier): handle stale replace directives
docs: update getting-started guide
```

Only `feat` and `fix` trigger releases. See [REVIEW.md](REVIEW.md) for full guidelines.

## Tests

- All tests use `package xxx_test` (blackbox only).
- Bug fix = test first: red test commit, then fix commit. Never combined.
- Run `task test` before pushing.

## Code review

See [REVIEW.md](REVIEW.md) — structural review rules, naming conventions, hard thresholds.
