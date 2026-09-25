import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import { filterScriptGroups } from './filterScriptGroups';

const script = ({ name, command }: { readonly name: string; readonly command: string }) =>
  ({
    key: name,
    kind: 'manifest',
    name,
    command,
    source: 'package-json',
    relDir: '',
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
});
