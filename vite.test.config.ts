import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

/** Dev server for automated playtests: no HMR, so concurrent file edits never reload the page. */
export default mergeConfig(
  base,
  defineConfig({
    server: { port: 5190, strictPort: true, hmr: false },
  }),
);
