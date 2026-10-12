import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://adityaaswani.com',
  base: '/',
  output: 'static',
  redirects: {
    '/zoom': 'https://cmu.zoom.us/j/4722169152?pwd=FcpGRl2hzkghnYyiZRae9RFlO6mXLl.1',
  },
  integrations: [
    // Only the pages meant for search: no thank-you page and no /preview* design pages.
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !path.startsWith('/support/thanks') && !path.startsWith('/preview');
      },
    }),
  ],
});