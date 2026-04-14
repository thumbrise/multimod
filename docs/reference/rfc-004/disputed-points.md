---
title: "RFC-004 — Disputed Points"
---

---

## Disputed Points

This section documents challenges to the architecture and their resolutions — from adversarial reviews, user questions, design sessions, and operational experience. Each point was debated and resolved. The process matters more than the outcome.

### "Pipe-ecosystem from Go binaries is hypocrisy"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** Unix utilities weigh kilobytes. Each Go binary is 10-15MB. Four tools = 50MB. This is not Unix-way.

**Resolution:** argument about binary size was withdrawn by Skeptic — compile-time disk cost in 2026 is negligible. The real question was whether tools share domain knowledge (which would argue for one binary). Analysis showed that `internalPaths()` in multirelease is derivation from input data, not duplicated domain knowledge — like `wc` counting lines from stdin. The `_` prefix convention was identified as the one piece of shared knowledge — resolved by adding `workspace_only` to the JSON contract so multirelease does not need to interpret directory names.

**Precedent:** Terraform (state management) and Terragrunt (orchestration) — different binaries, different domains, communicate through files. Not plugins of each other.

**Amendment (RFC-002):** this point is superseded by D10 (single binary). The original analysis was correct — tools did not share domain knowledge at the time. The decision to merge into a single binary was driven by shared infrastructure, not shared domain. See ["Single binary = shared failure domain"](#single-binary-shared-failure-domain).

### "This is just semantic-release decomposed into boxes"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** version-bumper + multirelease + ghreleaser = same three steps as semantic-release.

**Resolution:** rejected. The detached commit model is fundamentally different from semantic-release's branch-tagging model. semantic-release uses `git tag --merged` to find previous versions — detached commits are unreachable from main, breaking the version chain. This is not a configuration issue but an architectural incompatibility. The Node ecosystem reached the same conclusion — changesets replaced semantic-release for monorepo use cases.

### "JSON contract is your vendor lock-in"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** multirelease reads JSON from gover model. Anyone wanting to use multirelease without gover must generate this JSON format.

**Resolution:** partially accepted. JSON is an open format, and the contract is simple enough to generate with `jq` or any language. However, the contract needs explicit versioning and stability guarantees. Resolution: add `"version": 1` field, document guarantees, require consumers to ignore unknown fields (forward compatibility).

**Note:** compatibility with `go list -json -m all` was investigated. The formats are structurally different (stream of objects vs hierarchical document) and serve different purposes (`go list` doesn't distinguish root/sub or track internal requires). Superset is not feasible, but the module map adds genuine value over `go list`.

**Amendment (RFC-002):** with single binary (D10), JSON contract becomes internal data structure, not inter-process contract. The `gover model` subcommand still outputs JSON for external consumers, but bump/notes/release consume module map in-process. JSON remains the external contract; internal communication is typed Go structs.

### "Zero-config doesn't scale to 40+ modules"

**Origin:** RFC-001 adversarial review (Skeptic), expanded in RFC-002 adversarial review (Critic).

**Challenge:** OTEL has 40+ modules with different lifecycle (stable v1.x, experimental v0.x). "Release all together" doesn't work. You need module groups.

**Resolution:** rejected. The question confuses monorepo with multi-module project.
40 modules with different lifecycles is not one multi-module project — it's multiple products in one repo. A monorepo can contain several multi-module projects, each with its own gover instance. Like a frontend team using lerna/nx inside a monorepo where backend teams don't care about lerna — each product manages its own lifecycle with its own tools.
gover targets one product with uniform lifecycle: core + official extensions, one version, one release. Module count is irrelevant — 2 or 50 modules with uniform lifecycle work identically.

**"But what about mixed stability within one product?"** — stress-tested through adversarial debate with an external critic.
The critic's edge case: `acme/sdk` with `core v1.x` (stable) + `plugins/kafka v0.x` (unstable) + `plugins/cloud v1.x` (stable). "I want to release core + cloud without touching kafka."

**The changelog test:** when you write "acme/sdk v1.6.0 released" — does kafka appear in that changelog? If yes — one product, one version. That kafka's API is still unstable is a documentation concern, not a versioning concern. `go get acme/sdk/plugins/kafka@v1.6.0` gives the user exactly the version the author considers compatible with this release. If no — kafka is a separate product with its own lifecycle, and should be managed by its own gover instance or live in its own repo.

**Precedent: PHP 8.0.** Zend Engine is the core. When JIT was added (PHP 8.0, November 2020 — new Tracing JIT and Function JIT compilation engines), PHP version bumped to a new major — architectural change to the product. But ext-redis, ext-imagick are separate products, separate authors, separate versions. PHP doesn't bump when ext-redis patches. Two levels: core + official extensions = one product. Community extensions = separate products.

**Precedent: PhpStorm 2025.3.** Adel Faizrakhmanov's Laravel Idea plugin lived for years as a separate paid plugin in JetBrains Marketplace — own version, own release cycle, own changelog. When JetBrains included it as a built-in feature in PhpStorm 2025.3 (December 2025), they bumped PhpStorm's version. Laravel support became a changelog item of the product release. The plugin is now pre-installed and enabled out of the box. Before inclusion — separate lifecycle. After inclusion — product lifecycle. Same transition: community extension → official extension = absorbed into product version.

**"Unstable" is an opinion, not a fact.** What counts as unstable? Prerelease tag (v0.x)? etcd sat on v0.x for years in production everywhere. Directory convention? Annotation? `golang.org/x/net/context` was "experimental" by naming convention but production-ready long before Go 1.7 stdlib inclusion. An OTEL-style checker that blocks stable → x/context would have blocked the entire Go ecosystem. Stability classification is a policy decision, not a tooling decision — pipe it: `gover model | your-stability-checker`. Same reasoning as ["Why don't you block on govulncheck"](#why-don-t-you-block-on-govulncheck-stable→unstable-deps).

**Critic's concession:** *"The philosophy of gover is consistent and self-sufficient. It doesn't just work for simple cases — it enforces architectural discipline: if versions are independent, these are independent products, and they must be managed independently."*

**Skeptic's valid point (from RFC-001 review):** convention without enforcement is documentation, not architecture. `_` prefix is enforced by gover (workspace-only classification) — this is tool enforcement, analogous to how Go compiler enforces `internal/`.

### "Detached commit is a hack"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** Prometheus accidentally got a detached release tag — chaos ensued. What about Go proxy, GitHub Archive, `git gc`?

**Resolution:** rejected. Detached commits behind tags are fully supported by Go module infrastructure. Verified through external research: `proxy.golang.org` caches modules permanently after first fetch, even if the source tag is deleted. Tags protect commits from `git gc`. The `-dev` tag on main provides traceability (which main commit produced the release).

**"Why not release branch?"** — debated across multiple rounds. Skeptic argued release branch allows amend and has branch protection. Implementor showed the fundamental problem: release branch contains publish-state (no replaces, pinned requires). Hotfix requires restoring dev-state on the branch, patching, then re-publishing. This mixes two states on one branch. With detached commit: hotfix on any dev-state branch → new detached commit. No state mixing.

**Arbiter resolved the LTS question:** any branch (main, release/v1.2, feature/x) can be source for detached commit. LTS branch contains dev-state, releases are detached from its HEAD. Same flow everywhere:

```
main (dev-state)           → detached v1.3.0
release/v1.2 (dev-state)   → detached v1.2.4
```

**Detached commit is a design trade-off, not an innovation:**

|                       | Detached commit                      | Release branch                   |
|-----------------------|--------------------------------------|----------------------------------|
| Cleanup after release | Not needed                           | Must delete or maintain          |
| Amend before push     | New commit required                  | Amend possible                   |
| Tag protection        | Limited (GitHub tag rules)           | Branch protection (mature)       |
| Hotfix workflow       | Patch dev-state → new detached       | Must restore dev-state on branch |
| LTS support           | Separate dev-state branch + detached | Release branch per version       |
| State mixing          | Never — branches always dev-state    | Branch alternates between states |

**Bugs found during review:** (1) `git push origin --tags` pushes all local tags, not just release tags — must use explicit tag list. (2) No cleanup of tags if push fails — retry gets "tag already exists". Both accepted as implementation bugs, not architectural flaws.

### "You compete with Go toolchain"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** `go work` and `go mod tidy` already solve parts of this. Go team may add more.

**Resolution:** accepted as conscious risk. The ecosystem uses `golang.org/x/mod/modfile` (official Go library) — correct side of the API boundary. If Go adds built-in multi-module release support, the ecosystem has served its purpose. Recommendation: CI job on Go release candidates to catch breaking changes early.

### "Why don't you block on govulncheck / stable→unstable deps?"

**Origin:** RFC-001 adversarial review (Skeptic).

**Challenge:** OTEL enforces that stable modules don't depend on unstable ones. Security-conscious teams run `govulncheck` as a required CI check. Why doesn't gover block on these?

**Resolution:** rejected. These checks belong in the release pipeline, not the PR pipeline. PR pipeline gates only what the PR author controls — three litmus tests (responsibility, determinism, idempotency). If any is "no" → Observation, not Gate. `govulncheck` and stability checks fail all three.
The deeper problem is Go-specific: where do you run release-time analysis? Go has no staging area — push tag = permanent publication via immutable `proxy.golang.org` cache. Dev-state go.mod hides real versions behind `replace ../` directives. You need publish-state to analyze, but publish-state means publication.
`gover release --write` solves this — staging worktree with publish-state, local tags without push. Go's missing `npm pack`. See [Full Pipeline Example](./capabilities.md#full-pipeline-example) for the full workflow.

**Precedent:** Let's Encrypt Boulder made govulncheck non-blocking — *"circumstances entirely outside our control can grind Boulder development to a halt"*. Tor Project moved `cargo audit` to advisory failure.

### "Single binary = shared failure domain"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** in the world of separate binaries, a bug in `multirelease` is fixed by updating `multirelease`. Users who only need `bump` don't download a new `multirelease`. With a mono-binary, users update everything to fix one subcommand. Separate binaries with a shared library give independent update cycles.

**Resolution:** rejected.
1. Go CLI tools have no partial update mechanism. `go install pkg@latest` downloads and compiles the entire module. Separate binaries with a shared library still require recompilation of each binary when the shared library changes.
2. Independent versioning of subcommands creates coordination burden on the user: "which version of bump is compatible with which version of release?" One binary, one version, one compatibility guarantee.
3. The alternative (shared library + separate binaries) has the same coupling — a breaking change in the shared library breaks all consumers. The difference is where the coupling is managed: in one repo (mono-binary) or across multiple repos (coordination tax).
4. Precedent: `git`, `docker`, `kubectl` — mono-binaries where a bug in `git log` ships with the same binary as `git tag`. No one demands separate `git-log` and `git-tag` binaries.
   **Critic's concession:** "I can't name a single Go CLI tool that versions subcommands independently."

### "git worktree admin files persist in CI"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** large monorepos cache `.git/` between CI runs. `git worktree add` creates entries in `.git/worktrees/`. If a previous run crashed, stale worktree admin files cause `git worktree add` to fail.

**Resolution:** accepted with mitigation. `git worktree prune` before `--write` removes stale admin entries. One-line fix. For the target niche (core + extensions, not gigabyte monorepos), `.git/` caching is uncommon. For self-hosted runners with persistent workspaces, `prune` is necessary.

**Critic's concession:** "Fair, 1:1."

### "Local tags trigger CI webhooks"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** `--write` creates tags → CI triggers fire → `--abort` deletes tags → CI job fails on phantom tags.

**Resolution:** rejected. **Factual error by Critic.** `git tag` creates local tags. No CI system monitors local tags — CI triggers fire on `git push`, not on local operations. There is no `post-tag` hook in git. Tags become visible to CI only after `--push`. The `--write` → `--abort` cycle never touches the remote.

**Critic's concession:** "You caught me on a factual error. Question closed. 0:1."

### "Zero config breaks where the tool is needed most"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** for 2 modules, `sed` is enough. For 15 modules with different lifecycles, zero-config can't handle it. The tool is too heavy for simple cases and too dumb for complex ones.

**Resolution:** rejected. The critique evaluates the tool against a use case it explicitly does not target. Target niche: core + optional extensions with uniform lifecycle. Module count is not the limiting factor — architecture pattern is. 50 modules with uniform lifecycle work identically to 2. For independent-lifecycle modules (microservices in a monorepo), gover is not the right tool — and says so explicitly.
Even for N=2, gover provides value that `sed` does not: acyclic dependency validation, pre-publish staging, `GOWORK=off` isolation check, and prevention of publishing broken go.mod to immutable Go Module Proxy.

**Critic's concession:** "I was judging a hammer by its ability to drive screws."

### "No dog-fooding = no credibility"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** `gcc` compiles itself. `rustc` compiles itself. gover doesn't manage its own multi-module monorepo. How can you trust a tool that doesn't eat its own dog food?

**Resolution:** rejected. gover is a CLI tool, not a library. Its target use case is multi-module Go libraries with optional extensions. gover itself is a single-module Go binary — it has no optional extensions, no sub-modules that users `go get` independently. Dog-fooding multi-module workflow on a single-module tool is artificial — like requiring a prosthetic limb manufacturer to amputate their own leg.
`thumbrise/resilience` serves as the first real consumer — a multi-module Go library with core + otel extension, real CI, real release pipeline. External validation is stricter than self-hosting: it catches assumptions that self-use would never expose.

**Precedent:** Terraform doesn't manage its own infrastructure with Terraform. Docker doesn't run inside Docker in production. The tool's domain and the tool's own build process are different domains.

**Critic's concession:** "The prosthetic analogy is apt. I withdraw the objection."

### "Acyclic validation is a black box"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** user creates a cyclic dependency (root → plugin → root). gover blocks the release. User has no lever to fix it without refactoring. The tool is a black box that says "no" without explaining how to fix it.

**Resolution:** rejected with evidence. gover outputs the full cycle path in the error message: `cyclic dependency detected: A → B → C → A — extract one module into a separate repository`. The error fires at discovery phase, before any git operation. The fix is architectural (break the cycle), not configurational — and the error message says exactly what to do.
Allowing users to bypass acyclic validation (e.g., via config flag) would enable publishing broken modules to the immutable Go Module Proxy. This is not a safety net you remove — it's a guardrail on a cliff.

**Critic's concession:** "You didn't just block the release — you showed me the working code and tests. My 'Vasya Pupkin' mine exploded in my own hands."

### "Why cwd-is-root? What if I want to run from a subdirectory?"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** I'm in `otel/` and want to run gover. Why force me to `cd ..`?

**Resolution:** rejected. `go.mod` files are not unique markers — there could be 10 in a directory tree. Traversing upward without a boundary is a footgun. Same convention as goreleaser and terraform: cwd is the project root. No upward traversal, zero edge cases.
Additionally, `go.work` might not exist yet — gover creates it. Using `go.work` as root marker is chicken-and-egg.

### "Why unconditional replaces for ALL modules? That's noisy!"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** sub-module `otel/` only depends on root. Why does it get replace directives for every other sub-module too?

**Resolution:** rejected. Chicken-and-egg problem. Developer writes `import "example.com/root"` → runs `go mod tidy` → tidy adds `require` → but no replace exists yet → tidy fetches from registry → gets wrong version or 404. The replace must exist **before** the require. Unconditional replaces guarantee this. Unused replaces are harmless — Go ignores them.

### "Why commit go.work? The Go team says not to!"

**Origin:** RFC-002 adversarial review (Critic). Expanded in RFC-003 design session.

**Challenge:** Go documentation advises against committing `go.work`. You're going against the official recommendation.

**Resolution:** rejected. The Go team's advice targets single-module projects where `go.work` is a local dev convenience. For multi-module projects, committed `go.work` means: after `git clone`, IDE works, `go mod tidy` works, `go test` works. Zero setup. The alternative — every developer runs `go work use ./otel ./grpc ./redis` after clone — is fragile and undiscoverable.

**Evidence (E2):** golang/go#51967 — *"Good practise dictates you should probably not commit your go.work file, but that's all it is, good practise."* This is opinion, not technical constraint.

**Amendment (RFC-003):** main branch = kitchen (dev-state), not restaurant (publish-state). Replace directives are committed — go.work follows same logic. go.work is a managed artifact: gover generates it, gover owns it, don't edit it. See D17.

### "You commit replace directives?! Users will get broken go.mod!"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** replace directives in committed go.mod will break consumers who `go get` the module.

**Resolution:** rejected. **Factual error.** Go **ignores** replace directives in dependencies. When a user does `go get example.com/your/module@v1.2.3`, Go reads the go.mod from the tagged commit but skips all replace directives. This is how Go works by design — replace is local-only. Users never see dev-state. The publish-state commit (behind the tag) has replaces stripped anyway as an extra safety layer.

### "What if someone imports my -dev tag?"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** the `-dev` traceability tag on main (`v1.2.3-dev`) could be imported by users, giving them dev-state go.mod.

**Resolution:** rejected. The `-dev` suffix is a semver pre-release identifier. `go get @latest` ignores pre-release versions by spec. A user would have to explicitly type `go get example.com/root@v1.2.3-dev`. And if they do — `require example.com/root v0.0.0` in dev-state will fail loudly at resolution. No silent bugs.

### "I renamed my module directory and releases broke!"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** renamed `otel/` to `observability/`, now old tags don't work, users' imports broke.

**Resolution:** not a gover problem. Renaming a Go module directory = changing the module path = breaking change for every downstream consumer. `github.com/you/project/otel` and `github.com/you/project/observability` are two different modules — like two different npm packages. Old tags still point to the old module path. New directory has zero release history. Every user must change their import paths manually. This is Go's rule, not gover's. gover sees current state, not history.

### "CI shows zero releases! All my tags are gone!"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** ran gover in CI, it reports no previous versions. All tags disappeared.

**Resolution:** not a gover problem. Your CI does `git clone --depth 1`. Shallow clone doesn't fetch tags. Add `fetch-depth: 0` or `git fetch --tags` to your CI config. gover reports what it sees in local git — no tags locally means no tags reported. gover warns if it detects a shallow clone with zero tags, but it won't fix your pipeline for you.

### "My root module depends on sub-modules. Will this work?"

**Origin:** RFC-002 adversarial review (Critic).

**Challenge:** root imports a sub-module. gover rejects it.

**Resolution:** rejected by design. Root is the zero-deps core. Sub-modules depend on root, not reverse. If root depends on a sub-module, the dependency graph has a cycle (root → sub → root via transitive) or root pulls sub-module's dependencies — defeating the purpose of multi-module isolation. gover rejects this at discovery phase with a clear error: `root module must not require internal sub-modules`. The fix is architectural: extract the shared code into root, or move the dependency into a separate sub-module. This is the standard Go multi-module convention (OTEL, Kubernetes, every major project).

### "Graph validation is a release feature, not a dev feature"

**Origin:** RFC-003 design session (Debate 1).

**Challenge:** Acyclic validation and root-requires-sub rejection — these matter for release. If someone doesn't use gover release, why would they care about graph validation?

**Resolution:** Validation = release value in pure form. But gover = governance layer, and governance includes both release and dev. A cyclic dependency is an architectural error regardless of whether you plan to release. gover catches it at discovery phase — prevention over detection. The value is not "your release won't break" but "your architecture won't rot."

**Amendment (RFC-003):** with the positioning shift to "governance layer", graph validation is no longer positioned as a release feature. It's an architectural invariant enforced at dev-time.

### "Does gover even need go.work?"

**Origin:** RFC-003 design session (Debate 3).

**Challenge:** gover doesn't use go.work for its own operations. Discovery reads go.mod files directly. Replace management reads/writes go.mod directly. Why generate go.work at all?

**Fact:** gopls v0.15.0+ "zero-config" mode provides partial IDE support via replace directives: sub → root navigation works, root → sub does not. go.work provides full bidirectional navigation, cross-module Find All References, and refactoring support.

**Resolution:** go.work is needed for: (1) IDE — root→sub navigation, cross-module refactoring (upgrade from 80% to 100%); (2) `go test ./...` from root — tests all modules; (3) zero-setup after clone. Core dev-state mechanism = replace directives. go.work = cherry on top. gover generates it as a service to the developer, not as a dependency for itself.

### "GOWORK=off for all commands?"

**Origin:** RFC-003 design session (Debate 4).

**Challenge:** go.work in repository causes numerous documented problems. We should run all commands with GOWORK=off and iterate per-module. Always. No exceptions.

**Resolution:** rejected as absolute rule. GOWORK=off vs workspace mode = internal implementation detail. The user does not choose. gover decides what's faster/safer for each command. go.work is gover's artifact — gover knows when it's safe to use and when it's not. This is hidden behind the abstraction. See D18, D22.

### "Monorepo ≠ multi-module project"

**Origin:** RFC-003 design session (Debate 5).

**Challenge:** All messaging says "monorepo" but we know these are orthogonal concepts. The HN thread (E9) shows people confusing them — q3k suggests Bazel for "monorepos" when the actual problem is multi-module governance.

**Resolution:** terminology fix across all docs. "monorepo" → "multi-module project" everywhere except where explaining the difference. ~21 replacements in ~15 files. See D21.

### "Bazel solves this"

**Origin:** RFC-003 design session (Debate 6), triggered by HN thread E9.

**Challenge:** Bazel is suggested as a solution for multi-module Go projects.

**Resolution:** rejected. Bazel = build orchestration (parallel, cached, incremental builds across languages). gover = module governance (replace directives, go.work generation, version alignment, release transforms, sub-module tagging). Bazel does not manage go.mod files. gover does not manage build cache. Even Bazel users who publish Go modules to Go Module Proxy need go.mod management. Orthogonal tools, not competitors.

### "gover doctor — needed?"

**Origin:** RFC-003 design session (Debate 7).

**Challenge:** `gover doctor` could diagnose environment issues — find phantom go.work files, check Go version compatibility, warn about conflicts.

**Resolution:** rejected. doctor is a crutch for bad error messages. If gover at boot sees shallow clone — it says "shallow clone detected, some features may not work". If go.mod not found — actionable error with fix instruction. No separate diagnostic command needed. Go itself doesn't have `go doctor`. See R5.

### "--isolated flag — needed?"

**Origin:** RFC-003 design session (Debate 8).

**Challenge:** `--isolated` flag to force GOWORK=off for all commands.

**Resolution:** rejected. gover owns the abstraction. It decides when GOWORK=off is needed. Exposing this as a user-facing flag leaks implementation details. See R4, D18.

### "Nested sub-modules — footgun"

**Origin:** RFC-003 design session (Debate 9).

**Challenge:** a sub-module contains its own sub-modules. gover supports this (test exists), but if a user runs gover from the sub-module directory (not root), boot sees go.mod, finds nested subs, and thinks the sub-module is root. The "root = zero-deps core" invariant breaks.

**Resolution:** open question. Need validation: "you ran gover from a sub-module, not from root. Root is above you." See Q1.

### "500 modules — will it scale?"

**Origin:** RFC-003 design session (Debate 10).

**Challenge:** philosophy allows unlimited extensions. Per-module iteration at N=500 adds measurable overhead.

**Resolution:** optimization is an internal detail, not an architectural decision. Parallelization, workspace-mode shortcuts, GOWORK=on for safe commands — all hidden. User sees consistent behavior. Not included in RFC as a decision — it's an implementation concern. See D22, Q4.

### "Classifier rework — test/vet/build don't need iteration"

**Origin:** RFC-003 design session (Debate 12).

**Challenge:** Go workspace mode (Go 1.18+) makes `go test ./...` work across all modules. RFC-002 Problem Statement point 6 ("go test ./... in root does not test sub-modules") is factually wrong when go.work is present.

**Resolution:** accepted. Classifier must be reworked: remove test, vet, build from iteration. Iteration needed only for commands without workspace equivalent (mod tidy, broken tools). See D19.

**Note:** this is a spec decision, not a code change. Current classifier still iterates test/vet/build — implementation will catch up.

### "Evidence verification — DeepSeek hallucinations"

**Origin:** RFC-003 design session (Debate 13).

**Process:** DeepSeek provided 20+ evidence links. First session: 9 of 9 were hallucinations or mismatches. Second session: two-round verification with manual URL checking.

**Result:** E11 (golang/go#56868) returned 404 — removed, ID preserved for stable references. All other evidence (E10, E12–E21) verified as valid. See [Evidence Base](./evidence.md) for the full catalog.

**Lesson:** LLM-provided evidence requires manual verification. Every link, every quote, every claim. Trust but verify is not enough — verify then trust.

### "hasGitDir — file vs directory"

**Origin:** RFC-003 design session (Debate 14).

**Challenge:** Git submodules use `.git` file (not directory). Current code checks `info.IsDir()` — misses the submodule case.

**Resolution:** minor fix needed. Check existence (`err == nil`), not `isDir()`. Or rename to `hasGit`. See Q5.

### "Selective release — rejected"

**Origin:** RFC-003 design session (Debate 15).

**Challenge:** RFC-002 listed selective release as "future work."

**Resolution:** reclassified from "future work" to "rejected." Module groups are rejected (see ["Zero-config doesn't scale"](#zero-config-doesn-t-scale-to-40-modules)) → selective release has no use case. One product = one version = one release. See R2.

### "IDE — replace vs go.work"

**Origin:** RFC-003 design session (Debate 16).

**Fact (verified):** gopls v0.15.0+ "zero-config" mode:
- sub → root navigation via replace: **works**
- root → sub navigation: **does NOT work** (root doesn't know about sub)
- Cross-module Find All References: **partial** (only sub → root direction)

**Resolution:** replace = partial IDE (80%). go.work = full IDE (100%). gover generates go.work = upgrade from partial to full. This is one of the three reasons go.work exists in gover (alongside `go test ./...` coverage and zero-setup after clone).

### "Workspace-only modules — always in go.work"

**Origin:** RFC-003 design session (Debate 18).

**Challenge:** should `_`-prefixed modules be excluded from go.work since they're not released?

**Resolution:** rejected. `_` modules are always in go.work. go.work = dev-state. IDE must see tools, test utilities, generators. There is no reason to exclude a module from the workspace — if it's in the repo, it's part of the project. `_` prefix controls release behavior (not tagged), not workspace membership.

---

## RFC-004 Disputed Points

Challenges from RFC-004 adversarial review (DeepSeek, 4 rounds) and user dialogue stress-testing.

### "multimod → gover is just a rebrand"

**Origin:** RFC-004 adversarial review (DeepSeek, round 1).

**Challenge:** renaming doesn't change the tool. What about the existing `vanillaiice/gover` package?

**Resolution:** rejected. Not a rebrand — a scope expansion. `multimod` lied about scope (only multi-module). `gover` reflects actual capabilities (governance of any Go project). vanillaiice/gover is a text replacement utility (rewrites `const version` in `.go` files). Zero stars, zero forks, GPL-3.0. Categorical difference — like comparing `sed` with `git`. In Go there's no central registry — different module paths, different binaries. Verified through dedicated research: pkg.go.dev, GitHub, npm, PyPI, crates.io, Homebrew — `gover` is available everywhere except Go (where the existing project is dead and unrelated). See D25.

### "Different codepaths for single vs multi-module"

**Origin:** RFC-004 adversarial review (DeepSeek, round 1).

**Challenge:** single-module and multi-module projects will need different implementations. This doubles testing surface and creates edge cases.

**Resolution:** rejected as leaking abstraction. User doesn't inspect npm internals before calling it. gover discovers multi-module by convention and handles it transparently. `gover bump` doesn't know how many modules you have — doesn't need to. `gover notes` doesn't know. `gover build` doesn't know. `gover release` for multi-module adds prefix tags — that's its job, not the user's concern. The abstraction is: gover works with your Go project. How many go.mod files you have is gover's internal detail.

### "gover build — just use go build + tar + sha256sum"

**Origin:** RFC-004 adversarial review (DeepSeek, round 1).

**Challenge:** cross-compilation is trivial. Shell script with a loop. Why a dedicated subcommand?

**Resolution:** rejected. If it's trivial, why did GoReleaser seal this logic inside a monolith with proprietary YAML config? Because matrix iteration, archive format per OS, checksum file generation, naming conventions — nontrivial glue. Shell scripts for this aren't testable. Stress-tested in PR #23 discussion: "write 3 shell files" → "will you write tests for them?" — checkmate. Shell passes litmus test for composability but fails for testability. gover build extracts the fundamental part as a composable, testable Go primitive. Convergent design with cargo-dist confirms the pattern. See D27.

### "Open config format — litmus test is hypothetical"

**Origin:** RFC-004 adversarial review (DeepSeek, round 2).

**Challenge:** no other tool reads gover's config format. The "open format" claim is unverifiable.

**Resolution:** rejected. Adoption doesn't come before proposal. Requiring users before product is like requiring tenants before foundation. The litmus test checks an architectural property of the design: can another tool read this format? If documented and versioned — yes. This is a fact of design, not a prediction of adoption. Same principle as DAL interfaces — "we'll never switch databases" doesn't mean the interface is useless. The interface enables switching. The config format enables portability. Whether anyone uses it today is irrelevant to the architectural property. See D29, R7.

### "50k stars means good tool"

**Origin:** RFC-004 adversarial review (DeepSeek, round 2).

**Challenge:** GoReleaser has 50k stars. Who are you to call it an anti-pattern?

**Resolution:** 50k stars means the problem is real. The solution is a monolith with a paywall. We respect the authors' work. We don't compete. We offer an alternative architecture for those who value composable design over out-of-the-box monolith. GoReleaser is excellent at distribution (Docker, Homebrew, Snap, Scoop). gover is about governance (publish-state, staging, model, composable pipeline). Different tools, different strengths. Can be used together: `gover release --write --push` for governance, `goreleaser release --clean` for distribution. See D30.

### "Plugin architecture needed for extensibility"

**Origin:** RFC-004 adversarial review (DeepSeek, round 3).

**Challenge:** without plugins, users can't extend gover. go-semantic-release has a plugin system.

**Resolution:** rejected. Nobody writes plugins for `cat` or `ls`. They're primitives with clear contracts: stdin → stdout. Extension point is pipe, not plugin API. Don't like `gover build`? Don't use it. Run your own builder. Your builder doesn't know the project model? `gover model --json` — take the contract and do whatever you want. gover is a data source, not a framework. Plugin architecture is a sign that the tool doesn't know its boundaries. gover knows: fundamental inside, subjective through pipe. See R7.

### "Independent versioning in multi-module" (asked 4 times)

**Origin:** RFC-004 adversarial review (DeepSeek, rounds 1-4).

**Challenge:** multi-module projects may need independent versions per module (like OTEL).

**Resolution:** rejected. Asked and answered four times across four rounds. Final resolution through Three Project Types classification:

1. Single-module — one go.mod, one tag, one release (ghset, most Go projects).
2. Multi-module — multiple go.mod, one release, one lifecycle (resilience, golang/go).
3. Monorepo — multiple go.mod, different lifecycles, different products (OTEL).

gover serves 1 and 2. For 3 — out of scope by design. Not a limitation. An identity. Evidence: `golang/go` itself has three go.mod files and one tag per release **[E22]**. The Go team does not independently version std, cmd, and misc. One product = one version. This was already rejected in RFC-003 (R1: module groups), stress-tested through changelog test and PHP/PhpStorm precedents. The question is closed.

### "gover bump --patch with BREAKING CHANGE — dangerous"

**Origin:** RFC-004 adversarial review (DeepSeek, round 4).

**Challenge:** if conventional commits contain BREAKING CHANGE but user forces --patch, this could publish a breaking change as a patch version. Should gover block this or require confirmation?

**Resolution:** rejected. gover is a CLI pipe tool. Interactive prompts break pipe: `gover bump --patch | xargs gover release --write --push` — where would a prompt go? gover warns on stderr: `warning: BREAKING CHANGE detected but --patch requested`. Stdout: `v1.2.4`. User is in control. User's project, user's responsibility. gover is governance, not police. Subjective gates belong outside: wrap in a shell script that checks stderr for warnings. See R9.

### "Why not gover release --auto?"

**Origin:** RFC-004 user dialogue stress-testing.

**Challenge:** why require explicit version? Why not `gover release` that automatically calls `gover bump` internally?

**Resolution:** rejected. Implicit dependency between subcommands is framework thinking. `gover release` does not know about `gover bump`. `gover bump` does not know about `gover release`. They connect through stdout: `gover bump | xargs gover release --write --push`. Pipe, not implicit call. Want convenience? Shell alias: `alias gover-ship='v=$(gover bump) && gover release "$v" --write --push'`. That's your glue, not gover's.

### "Your tool is Go-specific but algorithms are language-agnostic"

**Origin:** RFC-004 user dialogue stress-testing.

**Challenge:** bump, notes, build — these algorithms work for any language. Why limit to Go?

**Resolution:** the algorithms are bricks. Go knowledge is cement. Without cement — a pile of separate bricks. With cement — a foundation. gover knows replace directives, publish-state, go.mod transforms, prefix tags, Go Module Proxy immutability, go.work footguns. Remove Go knowledge — what's left? Generic version bumper (svu exists). Generic changelog generator (git-cliff exists). Generic cross-compiler (doesn't apply — GOOS/GOARCH is Go-specific). The value is not in the algorithms — it's in the Go-specific governance that connects them. See R8.

