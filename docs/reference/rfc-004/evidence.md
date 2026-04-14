---
title: "RFC-004 — Evidence Base"
---

---

## Evidence Base: go.work Footguns

20 verified public sources confirming the problem space. Organized by category.

### Go Multi-Module Pain (from RFC-002, verified)

| ID | Source                                                                                                                                        | Topic                                                |
|----|-----------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| E1 | [golang/go#75900](https://github.com/golang/go/issues/75900)                                                                                  | Replace directives break `go install`                |
| E2 | [golang/go#51967](https://github.com/golang/go/issues/51967)                                                                                  | Multi-module monorepo lifecycle gaps                 |
| E3 | [golang/go#44347](https://github.com/golang/go/issues/44347)                                                                                  | Workspace proposal — original motivation             |
| E4 | [golang/go#45713](https://github.com/golang/go/issues/45713)                                                                                  | Multi-module tagging complexity                      |
| E5 | [golang/go#26664](https://github.com/golang/go/issues/26664)                                                                                  | Replace + go install incompatibility                 |
| E6 | [reddit r/golang](https://www.reddit.com/r/golang/comments/1jmijhp/)                                                                          | Community frustration with multi-module              |
| E7 | [reddit r/golang](https://www.reddit.com/r/golang/comments/1bz2a0o/)                                                                          | Replace directives leak into shared code             |
| E8 | [AWS Blog](https://aws.amazon.com/cn/blogs/opensource/simplifying-opentelemetry-collector-and-go-library-releases-with-the-go-multimod-tool/) | OTel MultiMod — industry precedent                   |
| E9 | [Hacker News](https://news.ycombinator.com/item?id=27028202)                                                                                  | "Extraordinarily brittle with Go" — community thread |

### go.work Specific Footguns (RFC-003, verified)

| ID  | Source                                                                                   | Topic                                                                 | gover answer                                                                   |
|-----|------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|--------------------------------------------------------------------------------|
| E10 | [golangci/golangci-lint#3798](https://github.com/golangci/golangci-lint/issues/3798)     | golangci-lint broken with go.work                                     | gover controls go.work generation; can use `GOWORK=off` for incompatible tools |
| E11 | *(removed — source invalidated during verification. ID preserved for stable references)* |                                                                       |                                                                                |
| E12 | [golang/go#51959](https://github.com/golang/go/issues/51959)                             | `go work use -r .` picks up test fixtures, creates unusable workspace | gover filters `vendor/`, `testdata/`, hidden dirs                              |
| E13 | [golang/go#57509](https://github.com/golang/go/issues/57509)                             | cwd-based workspace detection — phantom go.work from parent dir       | gover always knows its own go.work; root = cwd                                 |
| E14 | [golang/go#50038](https://github.com/golang/go/issues/50038)                             | go.work.sum auto-update + gopls masks go.sum errors                   | gover regenerates go.work from scratch; no stale state                         |
| E15 | [golang/go#65847](https://github.com/golang/go/issues/65847)                             | Toolchain directive auto-changes Go version                           | gover can enforce Go version alignment across modules                          |
| E16 | [golang/go#60056](https://github.com/golang/go/issues/60056)                             | Workspace vendoring incompatibility                                   | gover does not depend on vendoring; replace directives work without vendor     |
| E17 | [golang/go#65130](https://github.com/golang/go/issues/65130)                             | govulncheck broken in workspace mode                                  | gover can iterate govulncheck per-module with `GOWORK=off`                     |
| E18 | [golang/go#54611](https://github.com/golang/go/issues/54611)                             | go.work path parsing error causes build failure                       | gover generates correct relative paths from model                              |
| E19 | [golang/go#51558](https://github.com/golang/go/issues/51558)                             | `GOWORK` env silently affects build                                   | gover controls `GOWORK` env explicitly when proxying commands                  |

### Toolchain Issues (supplementary)

| ID  | Source                                                       | Topic                                                     |
|-----|--------------------------------------------------------------|-----------------------------------------------------------|
| E20 | [golang/go#70979](https://github.com/golang/go/issues/70979) | `GOTOOLCHAIN=local` + tool blocks → parse error           |
| E21 | [golang/go#71864](https://github.com/golang/go/issues/71864) | `golang.org/x/*` go directive forces toolchain directives |

### HN Thread Deep Analysis (E9)

The [Hacker News thread](https://news.ycombinator.com/item?id=27028202) (May 2021, 50+ comments) captures the community's unresolved frustration with Go multi-module projects. Key voices and gover's answers:

| Participant     | Claim                                                                                                                                          | gover's answer                                                                                                                                                                            |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **tsimionescu** | *"This is trivial to do with any other module system I've used (Maven, Nuget, Konan, pip, cargo), but it is extraordinarily brittle with Go."* | RFC-002 §1 comparison table confirms: Go is the only major language without multi-module tooling. gover closes this gap.                                                                  |
| **q3k**         | *"Modules are not for monorepos and internal components"* + *"just don't do that"*                                                             | Monorepo ≠ multi-module project. Orthogonal concepts. OTel, HashiCorp, CockroachDB use multi-module. The pattern is established.                                                          |
| **q3k**         | *"this requires tooling around your monorepo: proper CI, a fast build system"*                                                                 | Correct — tooling is needed. But Bazel solves build orchestration. gover solves module governance. Orthogonal. Even Bazel users need `go.mod` management for Go Module Proxy publication. |
| **Steltek**     | *"Go has the most awful module system I've ever used"*                                                                                         | Not awful — incomplete. gover completes it for multi-module projects.                                                                                                                     |
| **tsimionescu** | *"I've been trying to set up a Go monorepo... and it's been a mass of hacks"*                                                                  | Exactly the problem gover solves: replace management, workspace sync, coordinated release — without hacks.                                                                                |

**Thread conclusion:** No participant proposed a solution. Resignation: "just use Bazel" or "just don't do multi-module." Five years later, Go still has not answered. gover is the answer.

### Release Tooling Gaps (RFC-004, verified)

| ID  | Source / Evidence                                                                                        | Topic                                                                          |
|-----|----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| E22 | `golang/go` repository: `src/go.mod` (std), `src/cmd/go.mod` (cmd), `misc/go.mod` (misc)                | golang/go is multi-module (3 go.mod), one tag per release. Confirms one product = one version. |
| E23 | GoReleaser Pro `--prepare`/`--publish` — paid since v1.10 (July 2022)                                    | Prepare/publish separation is a paywall feature. gover has it by design (--write/--push). |
| E24 | semantic-release `--dry-run` — text-only output, no JSON, no exit code                                   | No machine-readable way to ask "will there be a release?" Confirmed across all forks. |
| E25 | `@semantic-release/exec` hack — `node -e` with `child_process.execSync` with `git log` inside JSON config | Community workaround proves the gap exists. The "solution" is proof there is no solution. |
| E26 | ghset PR #20 — GoReleaser `mode: keep-existing` silently skips uploads                                   | Real-world evidence of monolithic release tools failing when composed. |
| E27 | ghset PR #23 — release pipeline analysis leading to RFC-004 scope expansion                              | Trigger for multimod → gover rename and scope expansion to all Go projects. |
| E28 | go-semantic-release v2 (313 stars) — no prepare/publish, no JSON dry-run                                 | Go-native reimplementation inherits same architectural limitations. |
| E29 | uplift `--no-push` (38 stars, dead) — independently discovered prepare/publish pattern                   | Convergent design confirms the pattern. Project died, pattern survived. |
| E30 | 3 rounds ecosystem research — zero tools for: publish-state creation, config portability, project metadata as JSON, archive+checksum as standalone primitive | Comprehensive gap analysis across Go ecosystem. |
| E31 | `go.work` proposals in golang/go — none found for filtering, workspace-level tidy, or multi-module release | Go team is not planning to close these gaps. |

