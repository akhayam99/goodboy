// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { brandId, type AgentId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { SpawnedBranchContext } from './spawnedBranchContext';
import { SpawnedTreeRow } from './SpawnedTreeRow';
import { spawnedRailOf } from './spawnedRailOf';

const AGENT_ID = brandId<AgentId>({ value: 'agent-impl' });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type RowParams = {
  readonly labels: ReadonlyMap<AgentId, string>;
};

const showRow = ({ labels }: RowParams): HTMLElement => {
  const agent = anAgent({ id: AGENT_ID, name: 'Post one credit per retry' });
  const rail = spawnedRailOf({ nodes: [{ id: AGENT_ID, level: 1, isPending: false }] });
  const rowRail = rail.railById.get(AGENT_ID);
  if (rowRail === undefined) {
    throw new Error('no rail row');
  }
  render(
    <SpawnedBranchContext.Provider value={labels}>
      <SpawnedTreeRow
        id={AGENT_ID}
        agentId={AGENT_ID}
        level={1}
        hasChildren={false}
        rail={rowRail}
        railWidth={rail.width}
        glyph={null}
        role={null}
        title={agent.name}
        card={{ title: agent.name, facts: [] }}
        word="Running"
        time={null}
        isSelected={false}
        onOpen={() => undefined}
      />
    </SpawnedBranchContext.Provider>,
  );
  return screen.getByRole('treeitem');
};

describe('the agents rail row branch', () => {
  it('names the branch of the agent when the run touches more than one', () => {
    const row = showRow({ labels: new Map([[AGENT_ID, 'feat/retry-budget']]) });

    expect(row.querySelector('[data-spawned-branch]')?.textContent).toBe('feat/retry-budget');
  });

  it('says nothing when the run stays on one branch', () => {
    const row = showRow({ labels: new Map() });

    expect(row.querySelector('[data-spawned-branch]')).toBeNull();
  });
});
