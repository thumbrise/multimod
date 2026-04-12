import {defineConfig} from 'vitepress'  
  
const base = '/multimod/'  
const hostname = 'https://thumbrise.github.io'  
  
export default defineConfig({  
  title: 'multimod',  
  description: 'Governance CLI for Go multi-module projects. go.work tamer, dev-state guardian. Workspace sync, replace management, detached-commit releases, sub-module tagging. The missing cargo-release for Go.',  
  base,  
  sitemap: {  
    hostname: `${hostname}${base}`,  
  },  
  head: [  
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/multimod/favicon.svg' }],  
    ['link', { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/multimod/favicon-96x96.png' }],  
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/multimod/apple-touch-icon.png' }],  
    ['meta', { property: 'og:image', content: `${hostname}/multimod/og-image-multimod.png` }],  
    ['meta', { property: 'og:type', content: 'website' }],  
    ['meta', { name: 'twitter:card', content: 'summary' }],  
    ['meta', { name: 'keywords', content: 'go multi-module monorepo tool, golang workspace management, go.work automation, go mod replace strip publish, cargo-release for go, go sub-module tagging, zero-config go monorepo, go mod tidy multi-module, detached commit release go, go module release automation' }],  
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
      '/reference/': [  
        {  
          text: 'Reference',  
          items: [  
            {text: 'Index', link: '/reference/'},  
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
          ],  
        },  
      ],  
    },  
  
    socialLinks: [  
      {icon: 'github', link: 'https://github.com/thumbrise/multimod'},  
    ],  
  
    editLink: {  
      pattern: 'https://github.com/thumbrise/multimod/edit/main/docs/:path',  
    },  
  
    footer: {  
      message: 'Apache 2.0 · Built in public · Contributions welcome',  
    },  
  },  
})
