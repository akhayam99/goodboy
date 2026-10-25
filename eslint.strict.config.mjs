import { lintStrictConfig, UNTYPED_TWINS } from './eslint.config.mjs';

export default [
  { ignores: UNTYPED_TWINS },
  ...lintStrictConfig({
    files: [
      'apps/desktop/src/**/*.{ts,tsx}',
      'packages/*/src/**/*.{ts,tsx}',
      'website/src/**/*.{ts,tsx}',
    ],
    tsconfigRootDir: import.meta.dirname,
  }),
];
