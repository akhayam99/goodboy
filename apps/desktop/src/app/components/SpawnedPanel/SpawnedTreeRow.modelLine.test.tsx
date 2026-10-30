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
  readonly provider?: 'anthropic' | null;
  readonly model: string | null;
  readonly effort: 'high' | 'low' | null;
};

const showRow = ({ provider = 'anthropic', model, effort }: RowParams): HTMLElement => {
  const agent = anAgent({
    id: AGENT_ID,
    name: 'Post one credit per retry',
    ...(provider !== null && { providerOverride: provider }),
    ...(model !== null && { modelOverride: model }),
    ...(effort !== null && { effort }),
  });
  const rail = spawnedRailOf({ nodes: [{ id: AGENT_ID, level: 1, isPending: false }] });
  const rowRail = rail.railById.get(AGENT_ID);
  if (rowRail === undefined) {
    throw new Error('no rail row');
  }
  render(
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
      model={{ agent, routing: null }}
      isSelected={false}
      onOpen={() => undefined}
    />,
  );
  return screen.getByRole('treeitem');
};

describe('the agents rail row model line', () => {
  it('shows the model by name with its effort on the row, after the title', () => {
    const row = showRow({ model: 'sonnet-5.5', effort: 'high' });

    const line = row.querySelector('[data-model-line]');
    expect(line?.textContent).toBe('Sonnet 5.5 High');
    expect(row.textContent).not.toContain('sonnet-5.5');
    expect(row.textContent?.startsWith('Post one credit per retry')).toBe(true);
  });

  it('names only the provider when the agent has no model yet', () => {
    const row = showRow({ model: null, effort: null });

    expect(row.querySelector('[data-model-line]')?.textContent).toBe('Claude');
  });

  it('shows no line when the agent has no routing at all', () => {
    const row = showRow({ provider: null, model: null, effort: null });

    expect(row.querySelector('[data-model-line]')).toBeNull();
  });
});
