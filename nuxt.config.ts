export default defineNuxtConfig({
  modules: ['@nuxt/ui'],

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    claudeDir: process.env.CLAUDE_DIR || '',
    claudeCliPath: process.env.CLAUDE_CLI_PATH || '',
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  app: {
    head: {
      title: 'COGMINT — Agent Orchestration OS',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: 'Dark-first control plane for Claude Code agents, skills, workflows, sessions, and plugins.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0B0F17' },
        { property: 'og:title', content: 'COGMINT — Agent Orchestration OS' },
        { property: 'og:description', content: 'Dark-first control plane for Claude Code agents, skills, workflows, sessions, and plugins.' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.3/index.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/geist-mono@5.0.3/index.css' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  components: [
    { path: '~/components/chat', pathPrefix: false },
    { path: '~/components/studio', pathPrefix: false },
    { path: '~/components/cli', pathPrefix: false },
    { path: '~/components' },
  ],

  colorMode: {
    preference: 'light',
  },

  routeRules: {
    '/templates': { redirect: '/explore' },
  },
})
