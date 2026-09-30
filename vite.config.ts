import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs, so dist/ works from any static host path.
  base: './',
  plugins: [react()],
  test: {
    unstubGlobals: true,
    projects: [
      {
        // The CSDL core must not depend on the DOM, so its tests run without one.
        test: {
          name: 'csdl',
          include: ['src/{csdl,vocabularies}/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, 'src/csdl/**', 'src/vocabularies/**'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
