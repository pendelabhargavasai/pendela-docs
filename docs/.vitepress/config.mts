import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Pendela HomeLab Docs',
  description: 'Official documentation for Pendela HomeLabs',
  base: '/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/images/logos/logo.png' }],
    ['link', { rel: 'icon', href: '/favicon/favicon.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon/favicon-16x16.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon/favicon-32x32.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/favicon/site.webmanifest' }]
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
            { text: 'NGINX to Istio', link: '/articles/blogs/istio/' },
            { text: 'k3s on Proxmox', link: '/articles/blogs/proxmox/' },
            { text: 'Supply Chain Attacks', link: '/articles/blogs/IT-attacks/' },
          ]
        },
        {
          text: 'Pages',
          collapsed: true,
          items: [
            { text: 'Kubernetes Ecosystem', link: 'https://ke.pendela.in/' },
            { text: 'Kubernetes Distributions', link: 'https://kc.pendela.in/' },
            { text: 'Supply Chain Attacks', link: 'https://sc.pendela.in/' },
            { text: 'K8s ToolKit', link: 'https://k8skit.pendela.in/' },
          ]
        }
      ]
    },

    footer: {
      message: 'Made with ❤️ in India🛕 by `P.Bhargava Sai`',
      copyright: '2026 © pendela.in'
    },

    outline: 'deep',

    search: {
      provider: 'local'
    }
  }
})
