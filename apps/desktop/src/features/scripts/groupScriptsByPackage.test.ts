import { describe, expect, it } from 'vitest';
import type { ProjectScriptId } from '@goodboy/types';
import type { RunnableScript } from './buildSessionScripts';
import { groupScriptsByPackage } from './groupScriptsByPackage';

const manifest = ({
  name,
  packageName,
  relDir,
  source = 'package-json',
}: {
  readonly name: string;
  readonly packageName: string;
  readonly relDir: string;
  readonly source?: 'package-json' | 'composer';
}): RunnableScript => ({
  key: `${source}:${relDir}:${name}`,
  kind: 'manifest',
  name,
  body: `run ${name}`,
  invocation: `yarn run ${name}`,
  manager: 'yarn',
  source,
  packageName,
  relDir,
  category: 'other',
  savedId: null,
});

const SAVED: RunnableScript = {
  key: 'saved-seed',
  kind: 'saved',
  name: 'Seed sandbox',
  body: 'node ./tools/seed.mjs',
  invocation: 'node ./tools/seed.mjs',
  manager: '',
  source: 'saved',
  packageName: '',
  relDir: '',
  category: 'other',
  savedId: 'saved-seed' as ProjectScriptId,
};

describe('groupScriptsByPackage', () => {
  it('gives saved scripts, each workspace package and composer their own section', () => {
    const sections = groupScriptsByPackage({
      scripts: [
        SAVED,
        manifest({ name: 'dev', packageName: 'northwind', relDir: '' }),
        manifest({ name: 'dev', packageName: '@northwind/web', relDir: 'apps/web' }),
        manifest({ name: 'test', packageName: '@northwind/web', relDir: 'apps/web' }),
        manifest({ name: 'test', packageName: 'acme/server', relDir: '', source: 'composer' }),
      ],
    });

    expect(
      sections.map((section) => [
        section.source,
        section.packageName,
        section.scripts.map((script) => script.name),
      ]),
    ).toEqual([
      ['saved', '', ['Seed sandbox']],
      ['package-json', 'northwind', ['dev']],
      ['package-json', '@northwind/web', ['dev', 'test']],
      ['composer', 'acme/server', ['test']],
    ]);
  });
});
