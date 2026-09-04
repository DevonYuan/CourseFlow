import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default typescriptEslint.config(
  { ignores: ['dist/', 'node_modules/', '*.config.*', 'config/**', 'scripts/**', '.husky/', 'build/', 'coverage/'] },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  // Type-checked config for project source files
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./config/tsconfig.json', './config/tsconfig.*.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: [],
          alphabetize: { order: 'asc' },
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'off',
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Non-type-checked config for config files and scripts
  {
    files: ['config/**/*.ts', 'scripts/**/*.ts', '*.config.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: [],
          alphabetize: { order: 'asc' },
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'off',
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Backend Main process restrictions
  {
    files: ['src/backend/main/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../preload/**', '../frontend/**'],
              message: 'Main process must not import from Preload or Renderer',
            },
            {
              group: ['@backend/preload/**', '@backend/frontend/**'],
              message: 'Main process must not import from Preload or Renderer',
            },
          ],
        },
      ],
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  // Backend Preload process restrictions
  {
    files: ['src/backend/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../main/**', '../../frontend/**'],
              message: 'Preload must not import from Main or Renderer',
            },
            {
              group: ['@backend/main/**', '@backend/frontend/**'],
              message: 'Preload must not import from Main or Renderer',
            },
          ],
        },
      ],
    },
  },
  // Frontend Renderer process restrictions
  {
    files: ['src/frontend/**/*.ts', 'src/frontend/**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'Renderer must not import Electron APIs directly — use window.api instead',
            },
            { group: ['node:*'], message: 'Renderer must not import Node.js built-ins' },
            {
              group: ['../../backend/main/**', '../../backend/preload/**'],
              message: 'Renderer must not import from Main or Preload — use @shared instead',
            },
            {
              group: ['@backend/main/**', '@backend/preload/**'],
              message: 'Renderer must not import from Main or Preload — use @shared instead',
            },
          ],
        },
      ],
    },
  },
  // Backend Shared code restrictions
  {
    files: ['src/backend/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.es2022 },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'Shared code must not import Electron — zero dependencies allowed',
            },
            {
              group: ['node:*'],
              message: 'Shared code must not import Node.js built-ins — zero dependencies allowed',
            },
            {
              group: ['../main/**', '../preload/**', '../../frontend/**'],
              message: 'Shared code must not import from Main, Preload, or Renderer',
            },
            {
              group: ['@backend/main/**', '@backend/preload/**', '@backend/frontend/**'],
              message: 'Shared code must not import from Main, Preload, or Renderer',
            },
          ],
        },
      ],
    },
  },
  // Unicorn (opinionated good practices) - flat config with overly strict rules disabled
  {
    ...unicornPlugin.configs['flat/recommended'],
    rules: {
      ...unicornPlugin.configs['flat/recommended'].rules,
      'unicorn/expiring-todo-comments': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/import-style': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-for-loop': 'off',
      'unicorn/catch-error-name': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/prefer-query-selector': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/no-array-for-each': 'off',
    },
  },
  // Prettier compat (turn off conflicting rules)
  prettierConfig,
);