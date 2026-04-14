import {defineConfig} from 'vitepress'

const base = '/gover/'
const hostname = 'https://thumbrise.github.io'

export default defineConfig({
  title: 'gover',
  description: 'Composable governance CLI for Go projects. Version determination, release notes, cross-compilation, pre-publish staging, dev-state sync. For single-module and multi-module projects. The missing cargo-release for Go.',
  base,
  sitemap: {
    hostname: `${hostname}${base}`,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/gover/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/gover/favicon-96x96.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/gover/apple-touch-icon.png' }],
    ['meta', { property: 'og:image', content: `${hostname}/gover/og-image.png` }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'keywords', content: 'gover go governance cli, go multi-module tool, golang workspace management, go.work automation, go.work not working, go mod replace strip publish, cargo-release for go, go sub-module tagging, zero-config go project, go mod tidy multi-module, detached commit release go, go module release automation, goreleaser alternative, semantic-release go replacement, go cross compile archive checksum, cargo metadata for go, multiple go.mod one repo' }],
  ],
  transformHead({ pageData, siteData }) {
    const pageUrl = `${hostname}${base}${pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '.html')}`
    const pageTitle = pageData.title || siteData.title
    const pageDescription = pageData.description || siteData.description

    return [
      ['meta', { property: 'og:url', content: pageUrl }],
      ['meta', { property: 'og:title', content: pageTitle }],
      ['meta', { property: 'og:description', content: pageDescription }],
      ['meta', { name: 'twitter:title', content: pageTitle }],
      ['meta', { name: 'twitter:description', content: pageDescription }],
    ]
  },

  themeConfig: {
    nav: [
      {text: 'Getting Started', link: '/guide/getting-started'},
      {text: 'Reference', link: '/reference/'},
      {text: 'Devlog', link: '/devlog/'},
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            {text: 'Getting Started', link: '/guide/getting-started'},
          ],
        },
      ],
      '/reference/rfc-004/': [
        {
          text: 'RFC-004 — Ecosystem',
          items: [
            {text: 'Overview', link: '/reference/rfc-004/'},
            {text: 'Prior Art & Analysis', link: '/reference/rfc-004/prior-art'},
            {text: 'Capabilities', link: '/reference/rfc-004/capabilities'},
            {text: 'Disputed Points', link: '/reference/rfc-004/disputed-points'},
            {text: 'Evidence Base', link: '/reference/rfc-004/evidence'},
            {text: 'Decisions', link: '/reference/rfc-004/decisions'},
            {text: 'History', link: '/reference/rfc-004/history'},
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            {text: 'Index', link: '/reference/'},
            {text: 'RFC-004 — Ecosystem', link: '/reference/rfc-004/'},
            {text: 'RFC-003 — Ecosystem (2026-04-12)', link: '/reference/rfc-003-ecosystem'},
            {text: 'RFC-002 — Ecosystem (2026-04-12)', link: '/reference/rfc-002-ecosystem'},
            {text: 'RFC-001 — Ecosystem (2026-04-07)', link: '/reference/rfc-001-ecosystem'},
          ],
        },
      ],
      '/devlog/': [
        {
          text: 'Devlog',
          items: [
            {text: 'About This Devlog', link: '/devlog/'},
            {text: '#1 — The Great Migration', link: '/devlog/001-the-great-migration'},
            {text: '#2 — Gate vs Observation', link: '/devlog/002-gate-vs-observation'},
            {text: '#3 — When go.work Doesn\'t Go Work', link: '/devlog/003-when-go-work-doesnt-go-work'},
            {text: '#4 — The Name That Was Always There', link: '/devlog/004-the-name-that-was-always-there'},
          ],
        },
      ],
    },

    socialLinks: [
      {icon: 'github', link: 'https://github.com/thumbrise/gover'},
    ],

    editLink: {
      pattern: 'https://github.com/thumbrise/gover/edit/main/docs/:path',
    },

    footer: {
      message: 'Apache 2.0 · Built in public · Contributions welcome',
    },
  },
})
