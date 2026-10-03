import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'protocol']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    // Config files, e2e specs and scripts run in Node.
    files: ['*.{js,ts}', 'e2e/**/*.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    // tsc already reports unused declarations; the base rule misreads parameter names in type signatures.
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Callbacks passed to `page.evaluate` run in the browser.
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  prettier,
]);
