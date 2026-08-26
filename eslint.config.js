import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default typescriptEslint.config(
  {
    ignores: ['dist/', 'node_modules/', '*.config.*', '.husky/', 'build/', 'coverage/'],
  },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...typescriptEslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.*.json'],
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
    settings: {
      react: {
        version: '18.3',
      },
      'import/resolver': {
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',

      // Import rules
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

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['src/backend/main/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // Main must not import from preload or renderer
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../preload/**', '../frontend/**'],
              message: 'Main process must not import from Preload or Renderer',
            },
            {
              group: ['@/../preload/**', '@/../frontend/**'],
              message: 'Main process must not import from Preload or Renderer',
            },
          ],
        },
      ],
      // Disable unsafe-* rules that have false positives with catch blocks and branded types
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  {
    files: ['src/backend/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // Preload must not import from main or renderer (only shared)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../main/**', '../../frontend/**'],
              message: 'Preload must not import from Main or Renderer',
            },
            {
              group: ['@/../main/**', '@/../frontend/**'],
              message: 'Preload must not import from Main or Renderer',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/frontend/**/*.ts', 'src/frontend/**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      // Renderer must not import Electron or Node.js built-ins
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
              group: ['@/../backend/main/**', '@/../backend/preload/**'],
              message: 'Renderer must not import from Main or Preload — use @shared instead',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/backend/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.es2022 },
    },
    rules: {
      // Shared code must not import Electron or Node.js built-ins (pure TypeScript)
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
          ],
        },
      ],
    },
  },
);
