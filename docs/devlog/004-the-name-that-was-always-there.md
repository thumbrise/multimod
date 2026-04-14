---
title: "gover Devlog #4 — The Name That Was Always There"
description: "How a broken release pipeline revealed that multimod was never the name — it was the first use case. Three rounds of ecosystem research, stress-tested debates, and the discovery that Go itself follows our philosophy."
head:
  - - meta
    - name: keywords
      content: gover go governance cli, multimod rename gover, go release pipeline composable, goreleaser alternative, semantic-release go replacement, cargo metadata for go, go multi-module release tool, conventional commits go
---

# #4 — The Name That Was Always There
> "multimod was never the name. It was the first use case."

## The Trigger
ghset needed a release pipeline. A Go CLI tool — single binary, cross-platform, conventional commits, automated releases. Standard stuff in 2026.

Two tools. semantic-release for version determination + changelog + GitHub Release. GoReleaser for cross-compile + archive + checksum + asset upload. Both industry standards. 50k+ stars combined.

It took three PRs to make them work together. And "work" is generous.

PR #20: GoReleaser's `mode: keep-existing` silently skipped binary uploads because semantic-release created the GitHub Release first. The entire matrix build — wasted. Default `name_template` included version in filenames, breaking install scripts that expected stable names. GoReleaser ran unconditionally — even when semantic-release decided there was nothing to release — and crashed on missing tags. Every non-release push turned CI red.

PR #23: the deeper realization. These aren't configuration problems. These are architectural problems.

## The Autopsy
We asked semantic-release a simple question: "Will there be a release?"

No built-in way to ask. `--dry-run` outputs text to console — no JSON, no exit code, no machine-readable answer. The only "solution" the community offers: `@semantic-release/exec` plugin with `node -e` running `child_process.execSync` running `git log` with `grep` — inside a JSON config string. A shell command inside Node inside a plugin inside a dry-run. To answer "yes or no."

We asked GoReleaser: "Can I build without publishing?"

`--skip=publish` exists. But it's an afterthought — skip one step in a monolithic pipeline. No staging area. No abort. No rollback. Want `--prepare` / `--publish` separation? That's Pro. Paid. Since July 2022.

Want monorepo support? Pro. Custom hooks? Pro. Nightly builds? Pro.

Features that are architecturally free in composable design — behind a paywall in monolithic design. Not because they're hard to build. Because the architecture makes them premium add-ons instead of emergent properties.

## The Config Trap
Then the real pain hit. We had invested time and thought into `.releaserc.js` — 11 commit types mapped to changelog sections, custom Handlebars template with commit links and issue references, four BREAKING CHANGE keywords for human error protection, custom sort order, body wrapping. A considered, deliberate configuration.

Now we needed to change tools. And the config? Trash. Handlebars template — useless without semantic-release. Type mapping — in semantic-release's plugin format. Writer options — semantic-release-specific keys.

The convention was ours. The format was theirs. We invested in their format, not our convention. Vendor lock-in through configuration.

Every release tool does this. `.goreleaser.yml` — 500+ options in a proprietary DSL. `cliff.toml` — git-cliff specific. `.releaserc.js` — JavaScript with plugin imports. Each tool takes the same standard (Conventional Commits) and wraps it in a proprietary format. Change tools — rewrite config. Your convention, their format.

## The Research
Three rounds of ecosystem research. Every claim verified with URLs, stars, last commit dates.

The gaps we suspected — confirmed from multiple sources:
- **Publish-state creation** (strip replace directives, pin versions before publish) — zero tools in Go ecosystem.
- **Prepare/publish separation** — only GoReleaser Pro. Paid.
- **Project metadata as structured JSON** (like `cargo metadata --format-version 1`) — zero tools.
- **Config portability** between release tools — zero attempts. In any ecosystem.
- **Archive + checksum as a standalone composable primitive** — zero tools.
- **Machine-readable dry-run** ("will there be a release?") — zero tools. Not semantic-release, not its Go forks (go-semantic-release v2 with 313 stars — same limitation), not any alternative.

The closest competitors: uplift (38 stars, dead 2+ years) had `--no-push` — our `--write` pattern, independently discovered. go-semantic-release v2 (313 stars) — no prepare/publish, no JSON dry-run, no multi-module. gommitizen (8 stars) — language-agnostic, works with version files, not Go modules.

Every gap confirmed. Every alternative checked. The landscape is clear: Go has no composable release tooling.

## The Realization
multimod already owned the model. Module discovery, dependency graph, go.mod parsing, git history, conventions. GRASP information expert — the entity that has the data should have the behavior.

Version determination from conventional commits? multimod already parses git history for release. Release notes from commits? Same data source. Cross-compile matrix? The model knows the project. Structured JSON output? Already designed in RFC-001.

The capabilities were wider than the name promised. `multimod` said "I manage multi-module projects." The tool said "I govern Go project lifecycle." The name was lying.

## The Name
We didn't invent a name. We extracted it.

"Governance" — the word that appears in every RFC, every devlog, the README, the architectural description. Three RFC iterations, and governance was always the central concept. Dev-state governance. Publish-state governance. Convention governance.

`gover` = `go` + `govern`. Primary reading: governance. Secondary: `go` + `ver` (version). Both honest. Neither limits scope.

Five letters. Natural in CLI: `gover release --write --push`. No `-cli` suffix (docker, not docker-cli; kubectl, not kubectl-cli; terraform, not terraform-cli).

There's a `vanillaiice/gover` on GitHub — a text replacement utility that rewrites version strings in `.go` files. Zero stars, zero forks, GPL-3.0. The categorical difference is like comparing `sed` with `git` — both work with text, nobody calls them competitors. In Go there's no central registry — different module paths, different binaries.

The name was always there. We just needed three RFC iterations to see it.

## The Stress Test

Six new architectural decisions for RFC-004. DeepSeek as adversarial reviewer — angry user, skeptic, looking for holes.

Four rounds. Every decision attacked:

- **D25: Rename multimod → gover.** "What about the existing package?" — categorical difference, verified. "Consider `govern` or `gover-cli`?" — `govern` is 7 chars with no dual reading; `-cli` suffix is an anti-pattern.
- **D26: Single-module first-class.** "Different codepaths for single vs multi?" — leaking abstraction. User doesn't inspect npm internals before calling it. gover discovers multi-module by convention and handles it. `gover bump` doesn't know how many modules you have. Doesn't need to.
- **D27: gover build.** "Just use `go build` + `tar` + `sha256sum`." — Then why did GoReleaser seal this logic inside itself? Because matrix iteration, archive format per OS, checksum files, naming conventions — nontrivial glue. Shell scripts aren't testable. We stress-tested this: "write 3 shell files" → "will you write tests for them?" — checkmate.
- **D28: gover model.** "What if Go adds `cargo metadata` equivalent?" — no proposals found. Go team isn't planning this. If they do — gover served its purpose. Convergent design with `cargo metadata` discovered post-factum: same principles (structured stdout, versioned schema, forward compatibility) led to same architecture independently.
- **D29: Open config format.** "Litmus test is hypothetical — no other tools read your format." — Adoption doesn't come before proposal. Requiring users before product is like requiring tenants before foundation. The litmus test checks an architectural property: can another tool read this format? If documented and versioned — yes. Design fact, not adoption prediction.
- **D30: GoReleaser + semantic-release → Deathbook.** "50k stars means good tool." — 50k stars means the problem is real. The solution is a monolith with a paywall. We respect the authors' work. We don't compete. We offer an alternative architecture for those who value composable design over out-of-the-box monolith.
 
Plugin architecture? Rejected. Nobody writes plugins for `cat` or `ls`. They're primitives with clear contracts: stdin → stdout. Extension point is pipe, not plugin API. Don't like `gover build`? Don't use it. Your builder doesn't know the project model? `gover model --json` — take the contract and do whatever you want. gover is a data source, not a framework.

DeepSeek accepted all six decisions after four rounds.

## The Evidence Nobody Expected
While verifying our multi-module philosophy, we checked the most authoritative Go project in existence: `golang/go` itself.

Three `go.mod` files:
- `src/go.mod` → module `std`
- `src/cmd/go.mod` → module `cmd`
- `misc/go.mod` → module `misc`

Tags: `go1.26.2`, `go1.25.9`, `go1.26.1`... One tag per release. Three modules, one lifecycle, one version. The Go team doesn't independently version `std`, `cmd`, and `misc`. One product = one version.

This crystallized the classification:
1. **Single-module** — one `go.mod`, one tag, one release. Example: ghset, most Go projects.
2. **Multi-module** — multiple `go.mod`, multiple tags (prefix tags), one release, one lifecycle. Example: resilience (core + otel), golang/go (std + cmd + misc).
3. **Monorepo** — multiple `go.mod`, different lifecycles, different products. Example: OTEL (40+ modules with independent versions).
   gover serves 1 and 2. For 3 — out of scope by design. Not a limitation. An identity.

## The Dialogues
We tested the architecture through imaginary user conversations. Not formal specs — dialogues. Each one probed a boundary:

"Why so many commands instead of just `gover release`?" — You can: `gover release v1.2.3 --write --push`. One command. But four understandable commands are better than one magical command.

"Can I use GoReleaser with gover?" — Yes. `gover release` for governance (tags, publish-state). GoReleaser for distribution (Docker, Homebrew, Snap). Each does its thing.

"GoReleaser duplicated my changelog!" — You asked two tools to do the same job. That's like `cat file | cat file` and complaining about duplication. Not a bug in `cat`.

"Why split `--write` and `--push`?" — Go Module Proxy caches forever. Push a tag with broken `go.mod` — permanent. `--write` gives you a window to check. Go's missing `npm pack`.

"I want my own build logic." — Don't use `gover build`. Use yours. Your builder doesn't know the model? `gover model --json` — take it and go.

"Your tool is Go-specific but bump/notes are language-agnostic." — Correct. The algorithms are universal. The value is Go knowledge as cement: replace directives, publish-state, go.mod transforms, prefix tags, Go Module Proxy immutability. Remove Go — what's left? Generic tools that already exist and don't solve Go's problems.
Each dialogue either confirmed a decision or clarified a boundary. None broke the architecture.

## What Changed
| Before (RFC-003)                                  | After (RFC-004)                  |
|---------------------------------------------------|----------------------------------|
| `multimod`                                        | `gover`                          |
| Multi-module only                                 | Single-module + multi-module     |
| 6 subcommands                                     | 7 subcommands (+build, modules→model) |
| Module map JSON                                   | Full project model JSON          |
| `.multimod/release.toml`                          | Open config format               |
| "Governance Tooling for Go Multi-Module Projects" | "Governance CLI for Go Projects" |

What didn't change: composable design, unix philosophy, --write/--push/--abort, detached commits, platform publish out of scope, every subcommand replaceable. The foundation held. The identity expanded.

## The Pattern
The deathbook grows:

| # | GAP                         | Born inside | Status                         |
|---|-----------------------------|-------------|--------------------------------|
| 1 | Resilience patterns         | autosolve   | ✅ → thumbrise/resilience       |
| 2 | Multi-module management     | resilience  | ✅ → thumbrise/multimod         |
| 3 | Declarative repo settings   | multimod    | ✅ → thumbrise/ghset            |
| 4 | Composable release pipeline | ghset       | 🔄 → thumbrise/gover (RFC-004) |

Each entry follows the same script: concrete pain → honest research → minimal primitive → extract when ready.

ghset needed a release pipeline. The pipeline tools were monoliths. The monoliths had paywalls on composable features. The research confirmed the gaps. The tool that was already governing Go projects discovered it could govern more.

multimod didn't become gover. multimod was always gover. We just didn't know it yet.

---

*The name that was always there.*