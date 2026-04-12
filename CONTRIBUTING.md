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
go test ./...
```

## Development workflow

```bash
# Run tests
go test ./... -v

# Run lint (requires golangci-lint installed locally)
task lint

# Fix license headers
task generate
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

## Architecture

See the [RFC](https://thumbrise.github.io/multimod/reference/) — the single source of truth for architecture, design decisions, and disputed points.

## Code review

See [REVIEW.md](REVIEW.md) — structural review rules, naming conventions, hard thresholds.
