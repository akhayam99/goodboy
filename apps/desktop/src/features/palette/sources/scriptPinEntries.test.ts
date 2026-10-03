// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import type { ProjectScript, ProjectScriptId } from '@goodboy/types';
import { TEST_NOW, aProject } from '@goodboy/types/testing';
import { scriptPinId } from '../../scripts/scriptPinId';
import { scriptPinEntries } from './scriptPinEntries';

const LEDGER = aProject({ name: 'ledger-core' });
const RELAY = aProject({ name: 'notify-relay' });

const SAVED: ProjectScript = {
  id: 'script-replay' as ProjectScriptId,
  projectId: LEDGER.id,
  name: 'Replay settlement batch',
  body: 'pnpm replay',
  sortOrder: 0,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

describe('scriptPinEntries', () => {
  it('lists pinned scripts with the name of their project and runs the right one', () => {
    const run = vi.fn();
    const testPin = scriptPinId({
      source: 'package-json',
      relDir: '',
      name: 'test',
      savedId: null,
    });
    const savedPin = scriptPinId({
      source: 'saved',
      relDir: '',
      name: SAVED.name,
      savedId: SAVED.id,
    });
    const devPin = scriptPinId({ source: 'package-json', relDir: '', name: 'dev', savedId: null });

    const entries = scriptPinEntries({
      projects: [LEDGER, RELAY],
      pins: { [LEDGER.id]: [testPin, savedPin], [RELAY.id]: [devPin] },
      saved: [SAVED],
      run,
    });

    expect(entries.map((entry) => [entry.label, entry.detail, entry.tag])).toEqual([
      ['test', 'ledger-core', 'Pinned'],
      ['Replay settlement batch', 'ledger-core', 'Pinned'],
      ['dev', 'notify-relay', 'Pinned'],
    ]);
    entries[2]?.run();
    expect(run).toHaveBeenCalledWith({
      projectId: RELAY.id,
      projectName: 'notify-relay',
      pinId: devPin,
      name: 'dev',
    });
  });

  it('drops a pin whose saved script is gone or whose id does not parse', () => {
    const entries = scriptPinEntries({
      projects: [LEDGER],
      pins: { [LEDGER.id]: ['not json', JSON.stringify(['saved', '', 'script-gone'])] },
      saved: [SAVED],
      run: vi.fn(),
    });

    expect(entries).toEqual([]);
  });
});
