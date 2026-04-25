import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Pendela HomeLabs Docs',
  description: 'Official documentation for Pendela HomeLabs',
  base: '/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/images/logos/logo.png' }]
  ],

  // ✅ Don't treat docs/_templates as site pages
  srcExclude: ["**/_templates/**"],

  themeConfig: {
    siteTitle: "Pendela HomeLabs Docs",
    logo: '/images/logos/logo.png',

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

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pendelabhargavasai/pendela-docs' }
    ],

    footer: {
      message: 'Information, Commands, Configs, and Links.',
      copyright: '© pendela.in'
    },

    outline: 'deep',

    search: {
      provider: 'local'
    }
  }
})
