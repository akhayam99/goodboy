import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import { filterScriptGroups } from './filterScriptGroups';

const script = ({
  name,
  command,
  packageName = 'ledger-core',
  relDir = '',
}: {
  readonly name: string;
  readonly command: string;
  readonly packageName?: string;
  readonly relDir?: string;
}) =>
  ({
    key: `${relDir}:${name}`,
    kind: 'manifest',
    name,
    command,
    source: 'package-json',
    packageName,
    relDir,
    category: 'other',
    savedId: null,
  }) satisfies RunnableScript;

const group = ({
  mountId,
  projectName,
  scripts,
}: {
  readonly mountId: string;
  readonly projectName: string;
  readonly scripts: ReadonlyArray<RunnableScript>;
}) =>
  ({
    mountId: mountId as MountId,
    projectId: projectName as ProjectId,
    projectName,
    branch: 'nw/settlement',
    worktreePath: `/work/${projectName}`,
    isReady: true,
    packageCount: new Set(scripts.map((entry) => entry.relDir)).size,
    scripts,
  }) satisfies SessionScriptGroup;

const LEDGER = group({
  mountId: 'mount-ledger',
  projectName: 'ledger-core',
  scripts: [
    script({ name: 'test', command: 'vitest run' }),
    script({ name: 'lint', command: 'eslint .' }),
  ],
});
const RELAY = group({
  mountId: 'mount-relay',
  projectName: 'notify-relay',
  scripts: [script({ name: 'dev', command: 'node --watch src/' })],
});
const NORTHWIND = group({
  mountId: 'mount-northwind',
  projectName: 'northwind',
  scripts: [
    script({ name: 'dev', command: 'yarn run dev', packageName: 'northwind' }),
    script({
      name: 'dev',
      command: 'yarn run dev',
      packageName: '@northwind/web',
      relDir: 'apps/web',
    }),
    script({ name: 'dev', command: 'yarn run dev', packageName: '@acme/api', relDir: 'apps/api' }),
  ],
});

describe('filterScriptGroups', () => {
  it('keeps every group when the filter is empty', () => {
    expect(filterScriptGroups({ groups: [LEDGER, RELAY], query: '  ' })).toEqual([LEDGER, RELAY]);
  });

  it('matches name or command and drops groups with nothing left', () => {
    const result = filterScriptGroups({ groups: [LEDGER, RELAY], query: 'VITEST' });

    expect(result.map((entry) => entry.projectName)).toEqual(['ledger-core']);
    expect(result[0]?.scripts.map((entry) => entry.name)).toEqual(['test']);
  });

  it('keeps a whole group when the project name matches', () => {
    const result = filterScriptGroups({ groups: [LEDGER, RELAY], query: 'relay' });

    expect(result).toEqual([RELAY]);
  });

  it('matches the package name or folder of a workspace package', () => {
    const byName = filterScriptGroups({ groups: [NORTHWIND], query: '@acme' });
    const byFolder = filterScriptGroups({ groups: [NORTHWIND], query: 'apps/web' });

    expect(byName[0]?.scripts.map((entry) => entry.packageName)).toEqual(['@acme/api']);
    expect(byFolder[0]?.scripts.map((entry) => entry.packageName)).toEqual(['@northwind/web']);
    expect(byName[0]?.packageCount).toBe(3);
  });
});
