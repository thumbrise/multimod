# Contributing

Clone, test, read [REVIEW.md](REVIEW.md). Everything else — commit conventions, test rules, architecture — lives there.

## Requirements

- **Go** — see `go.mod` for exact version.
- **[golangci-lint](https://golangci-lint.run/welcome/install/)**
- **[Task](https://taskfile.dev/)** — `go install github.com/go-task/task/v3/cmd/task@latest`
- **Node.js** (optional) — commitlint and docs build only.

## Quick start

```bash
git clone <this-repo>
cd <repo-dir>
go test ./...
```

## Workflow

```bash
go test ./... -v     # tests
task lint            # lint (golangci-lint)
task generate        # license headers
```

## Architecture

See the docs site (link in README) — RFCs, design decisions, disputed points.
