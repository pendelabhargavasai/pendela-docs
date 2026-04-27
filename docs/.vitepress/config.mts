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
    siteTitle: "Pendela HomeLab",
    logo: '/images/logos/logo-2.png', //{ light: '/images/logos/logo-3.jpg', dark: '/images/logos/logo-1.jpg' },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Articles', link: '/articles/' },
    ],

    // Sidebar only appears when you're in /articles/
    sidebar: {
      "/articles/": [
        {
          text: 'Getting Started',
          link: '/articles/getting-started/'
        },
        {
          text: 'Articles',
          collapsed: true,
          items: [
            { text: 'Termix', link: '/articles/termix/' },
            { text: 'LinkStack', link: '/articles/linkstack/' }
          ]
        },
        {
          text: 'Blogs',
          collapsed: true,
          items: [
            { text: 'NGINX to Istio', link: '/articles/blogs/istio/' }
          ]
        }
      ]
    },

    footer: {
      message: 'A smile is a curve that sets everything straight',
      copyright: '2026 © pendela.in'
    },

    outline: 'deep',

    search: {
      provider: 'local'
    }
  }
})
