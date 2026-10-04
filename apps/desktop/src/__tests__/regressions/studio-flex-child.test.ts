// @vitest-environment node

import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = resolve(import.meta.dirname, '../..');
const STUDIO_USE = /StudioShell|FramedStudio|DetachedStudio/;
const DIV_CLASS = /<div\s+className="([^"]*)"/g;

const studioSources = (): ReadonlyArray<string> =>
  globSync('**/*.tsx', { cwd: SOURCE_ROOT })
    .filter((file) => !file.includes('.test.') && !file.includes('MockScene'))
    .filter((file) => STUDIO_USE.test(readFileSync(resolve(SOURCE_ROOT, file), 'utf8')));

describe('studio flex child', () => {
  it('finds the studios it guards', () => {
    expect(studioSources()).toContain('features/workflows/components/WorkflowStudio/index.tsx');
  });

  it('never gives a studio div flex-1 without making it a flex or grid container', () => {
    const offenders = studioSources().flatMap((file) =>
      [...readFileSync(resolve(SOURCE_ROOT, file), 'utf8').matchAll(DIV_CLASS)]
        .map((match) => match[1] ?? '')
        .filter((className) => {
          const tokens = className.split(/\s+/);
          return tokens.includes('flex-1') && !tokens.includes('flex') && !tokens.includes('grid');
        })
        .map((className) => `${file}: ${className}`),
    );

    expect(offenders).toEqual([]);
  });
});
