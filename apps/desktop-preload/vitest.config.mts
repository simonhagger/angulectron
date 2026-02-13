import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/desktop-preload',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'desktop-preload',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts,cts,js,mjs,cjs}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/desktop-preload',
      provider: 'v8' as const,
    },
  },
}));
