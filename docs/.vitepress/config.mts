import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Pendela HomeLab Docs',
  description: 'Official documentation for Pendela HomeLabs',
  base: '/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/images/logos/logo.png' }]
  ],

  // ✅ Don't treat docs/_templates as site pages
  srcExclude: ["**/_templates/**"],

  themeConfig: {
    siteTitle: "Pendela HomeLab Docs",
    logo: '/images/logos/logo-1.jpg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Articles', link: '/articles/' },
    ],

    // Sidebar only appears when you're in /articles/
    sidebar: {
      "/articles/": [
        {
          text: 'Articles',
          items: [
            { text: 'Getting Started', link: '/articles/getting-started/' }
            // Add new articles here:
            // { text: "Example header", link: "/articles/example-name/" }
          ]
        }
      ]
    },

    footer: {
      message: 'Information, Commands, Configs, and Links.',
      copyright: '2026 © pendela.in'
    },

    outline: 'deep',

    search: {
      provider: 'local'
    }
  }
})
