import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://adityaaswani.com',
  base: '/',
  output: 'static',
  // Inline the small per-page CSS so it doesn't block first paint.
  build: { inlineStylesheets: 'always' },
  redirects: {
    '/zoom': 'https://cmu.zoom.us/j/4722169152?pwd=FcpGRl2hzkghnYyiZRae9RFlO6mXLl.1',
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/support/thanks') }),
  ],
});