import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://linkbocilfb.pages.dev',
  output: 'hybrid',
  adapter: cloudflare(),
});
