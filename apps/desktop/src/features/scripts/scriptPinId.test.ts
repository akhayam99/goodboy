// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { ProjectScriptId } from '@goodboy/types';
import { discoveredScriptId } from './scripts';
import { scriptPinId } from './scriptPinId';

describe('scriptPinId', () => {
  it('stays the same for one script across two worktrees of a project', () => {
    const first = { source: 'package-json' as const, relDir: 'packages/ledger', name: 'test' };
    const keys = ['/repos/ledger-core', '/repos/ledger-core/.goodboy/worktrees/har-212'].map(
      (worktreePath) => discoveredScriptId({ worktreePath, ...first }),
    );

    expect(keys[0]).not.toBe(keys[1]);
    expect(scriptPinId({ ...first, savedId: null })).toBe(scriptPinId({ ...first, savedId: null }));
    expect(scriptPinId({ ...first, savedId: null })).not.toContain('/repos/ledger-core');
  });

  it('tells apart the folder, the source and the name, and pins a saved script by its id', () => {
    const base = { source: 'package-json' as const, relDir: '', name: 'test', savedId: null };
    const ids = new Set([
      scriptPinId(base),
      scriptPinId({ ...base, relDir: 'packages/ledger' }),
      scriptPinId({ ...base, source: 'composer' }),
      scriptPinId({ ...base, name: 'lint' }),
      scriptPinId({
        source: 'saved',
        relDir: '',
        name: 'Replay settlement batch',
        savedId: 'script-replay' as ProjectScriptId,
      }),
    ]);

    expect(ids.size).toBe(5);
    expect(
      scriptPinId({ source: 'saved', relDir: '', name: 'Renamed', savedId: 'script-replay' }),
    ).toBe(scriptPinId({ source: 'saved', relDir: '', name: 'Old', savedId: 'script-replay' }));
  });
});
