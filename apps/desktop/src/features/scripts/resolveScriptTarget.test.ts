import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, ProjectScriptId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import { resolveScriptTarget } from './resolveScriptTarget';

const SAVED: RunnableScript = {
  key: 'script-1',
  kind: 'saved',
  name: 'Replay settlement batch',
  body: 'node ./tools/replay.mjs',
  invocation: 'node ./tools/replay.mjs',
  manager: '',
  source: 'saved',
  packageName: '',
  relDir: '',
  category: 'other',
  savedId: 'script-1' as ProjectScriptId,
};

const group = ({ mountId, branch }: { readonly mountId: string; readonly branch: string }) =>
  ({
    mountId: mountId as MountId,
    projectId: 'project-ledger' as ProjectId,
    projectName: 'ledger-core',
    branch,
    worktreePath: `/work/${mountId}`,
    isReady: true,
    packageCount: 0,
    scripts: [SAVED],
  }) satisfies SessionScriptGroup;

const SETTLEMENT = group({ mountId: 'mount-a', branch: 'nw/settlement' });
const ROUNDING = group({ mountId: 'mount-b', branch: 'nw/fix-rounding' });

describe('resolveScriptTarget', () => {
  it('picks the mount the run belongs to when a project is mounted twice', () => {
    const target = resolveScriptTarget({
      groups: [SETTLEMENT, ROUNDING],
      scriptKey: 'script-1',
      mountId: 'mount-b' as MountId,
    });

    expect(target?.group.branch).toBe('nw/fix-rounding');
  });

  it('falls back to the first mount that has the script when the run has no mount', () => {
    const target = resolveScriptTarget({
      groups: [SETTLEMENT, ROUNDING],
      scriptKey: 'script-1',
      mountId: null,
    });

    expect(target?.group.branch).toBe('nw/settlement');
  });

  it('returns nothing for a script that left the session', () => {
    expect(
      resolveScriptTarget({ groups: [SETTLEMENT], scriptKey: 'gone', mountId: null }),
    ).toBeNull();
  });
});
