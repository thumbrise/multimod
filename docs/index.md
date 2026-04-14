---
layout: home

hero:
  name: gover
  text: Composable governance CLI for Go projects
  tagline: 'Version determination, release notes, cross-compilation, pre-publish staging, dev-state sync. For single-module and multi-module projects. No YAML DSL. No monolithic pipeline. Unix-way subcommands, structured stdout, every step replaceable.'
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: Reference
      link: /reference/
    - theme: alt
      text: GitHub
      link: https://github.com/thumbrise/gover

features:
  - icon: 🚧
    title: Work In Progress
    details: "Architecture under active RFC development — stress-tested through adversarial review. Previously multimod — renamed to gover after scope expansion."
    link: /reference/
    linkText: Read the RFC →
  - icon: 🔍
    title: Zero Configuration
    details: "Directory structure is the config. A go.mod in a subdirectory = a sub-module. No YAML, no TOML, no config files. Discovery is automatic, deterministic, and auditable."
  - icon: 🔄
    title: Always Synced
    details: "Every invocation guarantees the filesystem matches the desired state. go.work, replace directives, go version alignment — all synced. You cannot forget. You cannot drift."
  - icon: 🏷️
    title: Staging Before Point of No Return
    details: "Go Module Proxy caches forever. --write creates staging worktree with publish-state. Check before you push. --push ships. --abort rolls back. Go's missing npm pack."
    link: /guide/getting-started
    linkText: How it works →
  - icon: 🔗
    title: Composable Subcommands
    details: "gover bump | gover release | gover build | gover notes | gh release create. Each does one thing. Any replaceable with svu, git-cliff, goreleaser, or a shell script."
    link: /guide/getting-started
    linkText: See the design →
  - icon: 📦
    title: Works For All Go Projects
    details: "Library? bump + release + notes. CLI tool? Add build. Multi-module? Add dev-state sync. Single-module is first-class, not degraded mode."
    link: /reference/
    linkText: Three project types →
---
