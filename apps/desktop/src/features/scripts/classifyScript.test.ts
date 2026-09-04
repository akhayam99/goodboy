import { describe, expect, it } from 'vitest';
import { categoryCounts, classifyScript, SCRIPT_CATEGORIES } from './classifyScript';

describe('classifyScript', () => {
  it.each([
    ['typecheck', 'echo ok', 'typecheck'],
    ['type-check', 'echo ok', 'typecheck'],
    ['checkTypes', 'echo ok', 'typecheck'],
    ['test:types', 'vitest', 'typecheck'],
    ['unit:test', 'echo ok', 'test'],
    ['spec', 'echo ok', 'test'],
    ['coverage', 'echo ok', 'test'],
    ['lint:fix', 'prettier --write .', 'lint'],
    ['quality', 'biome check .', 'lint'],
    ['fmt:check', 'eslint .', 'format'],
    ['pretty', 'prettier --write .', 'format'],
    ['build', 'echo ok', 'build'],
    ['package:bundle', 'echo ok', 'build'],
    ['build:storybook', 'storybook build', 'build'],
    ['dev', 'echo ok', 'dev'],
    ['serve-app', 'echo ok', 'dev'],
    ['db:migrate', 'echo ok', 'db'],
    ['data', 'prisma migrate', 'db'],
    ['codegen', 'echo ok', 'generate'],
    ['api', 'openapi generate', 'generate'],
    ['env:pull', 'echo ok', 'install'],
    ['bootstrap', 'echo ok', 'install'],
    ['deploy', 'echo ok', 'deploy'],
    ['ship-it', 'changeset publish', 'deploy'],
    ['clean', 'echo ok', 'clean'],
    ['nuke-cache', 'echo ok', 'clean'],
    ['storybook', 'echo ok', 'docs'],
    ['typedoc', 'echo ok', 'docs'],
    ['something', 'echo ok', 'other'],
  ] as const)('classifies %s as %s', (name, command, expected) => {
    expect(classifyScript({ name, command })).toBe(expected);
  });

  it('keeps the published category order', () => {
    expect(SCRIPT_CATEGORIES.map((category) => category.id)).toEqual([
      'dev',
      'build',
      'test',
      'lint',
      'typecheck',
      'format',
      'db',
      'generate',
      'install',
      'deploy',
      'clean',
      'docs',
      'other',
    ]);
  });

  it('counts every category with zeroes for missing categories', () => {
    const counts = categoryCounts({
      scripts: [
        { name: 'dev', command: 'vite' },
        { name: 'test:unit', command: 'vitest' },
        { name: 'test:e2e', command: 'playwright test' },
      ],
    });

    expect(counts.dev).toBe(1);
    expect(counts.test).toBe(2);
    expect(counts.other).toBe(0);
  });
});
