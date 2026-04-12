---
layout: home

hero:
  name: multimod
  text: The missing cargo-release for Go
  tagline: 'Governance CLI for Go multi-module projects. go.work tamer, dev-state guardian. Workspace sync, replace management, detached-commit releases, sub-module tagging. No YAML. No shell scripts. Just go.mod.'
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: Reference
      link: /reference/
    - theme: alt
      text: GitHub
      link: https://github.com/thumbrise/multimod

features:
  - icon: 🚧
    title: Work In Progress
    details: "Honest status: RFC is solid, proof of concept works. Not production-ready yet. We're building in public — the RFC drives development, not the other way around."
    link: /reference/
    linkText: Read the RFC →
  - icon: 🔍
    title: Zero Configuration
    details: "Directory structure is the config. A go.mod in a subdirectory = a sub-module. No YAML, no TOML, no .multimod.json. Discovery is automatic, deterministic, and auditable."
  - icon: 🔄
    title: Always Synced
    details: "Every invocation guarantees the filesystem matches the desired state. go.work, replace directives, go version alignment — all synced. You cannot forget. You cannot drift."
  - icon: 🏷️
    title: Detached-Commit Releases
    details: "Publish-state lives on a detached git commit behind a tag. Main never leaves dev-state. go get @v1.2.3 gets clean go.mod. Developers never see broken state."
    link: /reference/
    linkText: How it works →
  - icon: 🔗
    title: Composable Subcommands
    details: "multimod release v1.2.3 --write --push. Each subcommand does one thing. Any subcommand replaceable with svu, git-cliff, gh, or a shell script."
    link: /reference/
    linkText: See the design →
---
