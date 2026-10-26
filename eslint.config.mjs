import reactHooks from 'eslint-plugin-react-hooks';
import regexp from 'eslint-plugin-regexp';
import tseslint from 'typescript-eslint';
import { BOOLEAN_PREFIXES } from './scripts/rules/ast/booleanPrefixes.mjs';

export const lintTsConfig = ({ files, tsconfigRootDir }) =>
  tseslint.config({
    files,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      regexp,
    },
    rules: {
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableBoolean: false }],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['variable', 'parameter', 'typeProperty', 'classProperty', 'parameterProperty'],
          types: ['boolean'],
          format: null,
          prefix: BOOLEAN_PREFIXES,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      'react-hooks/exhaustive-deps': 'error',
      'regexp/no-super-linear-backtracking': 'error',
    },
  });

const EQEQEQ = 'eqeqeq';

export const lintStrictConfig = ({ files, tsconfigRootDir }) =>
  tseslint.config({
    files,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowNullableEnum: false,
          allowAny: false,
        },
      ],
      [EQEQEQ]: ['error', 'always', { null: 'ignore' }],
    },
  });

export const UNTYPED_TWINS = [
  'apps/desktop/src/features/branch/hooks/useBranchIdentity/index.test.tsx',
  'apps/desktop/src/features/resolve/notes/useBranchNotes/index.test.tsx',
  'apps/desktop/src/features/session/hooks/usePageCountFacts/index.test.tsx',
  'packages/ui/src/__tests__/useDropdown.test.tsx',
];

export default [
  { ignores: UNTYPED_TWINS },
  ...lintTsConfig({
    files: [
      'apps/desktop/src/**/*.{ts,tsx}',
      'packages/*/src/**/*.{ts,tsx}',
      'website/src/**/*.{ts,tsx}',
    ],
    tsconfigRootDir: import.meta.dirname,
  }),
];
