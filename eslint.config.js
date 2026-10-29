import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'tests/server/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['client/**/*.js', 'tests/client/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser },
  },
];
