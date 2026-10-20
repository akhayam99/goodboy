// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { aDelegation, aView, FIXTURE_NOW, FIXTURE_ROOT } from '../testing/autoViewFixtures';
import { autoGroupOf, type AutoGroup } from '../autoGroupOf';
import { AutoAgentGroup } from './AutoAgentGroup';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const ROOT = anAgent({ id: FIXTURE_ROOT, name: 'Harden retries in payments-api' });

const groupOf = (): AutoGroup => {
  const view = aView({
    phase: 'waiting',
    delegations: [
      aDelegation({ key: 'reviewer', role: 'reviewer', state: 'settled', outcome: 'completed' }),
      { ...aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' }), slot: 1 },
    ],
    deliveredResults: [
      {
        runId: brandId({ value: 'run-1' }),
        delegationId: 'delegation-reviewer',
        childAgentId: brandId<AgentId>({ value: 'agent-reviewer' }),
        role: 'reviewer',
        provider: null,
        model: null,
        outcome: 'completed',
        summary: 'Found 2 doc mismatches',
      },
    ],
  });
  const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW + 90_000 });
  if (group === null) {
    throw new Error('no group');
  }
  return group;
};

describe('AutoAgentGroup', () => {
  it('names a child that never started and opens it in the auto-child drawer', () => {
    render(<AutoAgentGroup group={groupOf()} isCompact={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'work for fixer, never started' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'auto-child',
      payload: { agentId: 'agent-fixer' },
    });
  });

  it('shows the outcome, the state word and the reason line', () => {
    render(<AutoAgentGroup group={groupOf()} isCompact={false} />);

    screen.getByText('Found 2 doc mismatches');
    screen.getByText('Never started');
    screen.getByText(/no first message reached it/);
    expect(screen.queryByText('Auto asked: work for reviewer')).toBeNull();
  });

  it('says Stuck in the header when a child is stuck, the same word as the Now card', () => {
    render(<AutoAgentGroup group={groupOf()} isCompact={false} />);

    const word = document.querySelector('[data-auto-word]');
    expect(word?.textContent).toBe('Stuck');
    expect(word?.getAttribute('data-auto-word')).toBe('stuck');
  });

  it('holds no Button, only row buttons', () => {
    render(<AutoAgentGroup group={groupOf()} isCompact={false} />);

    const buttons = screen.getAllByRole('button');

    expect(buttons).toHaveLength(2);
    expect(buttons.filter((button) => button.hasAttribute('data-variant'))).toEqual([]);
  });

  it('folds a finished tree into one line', () => {
    const group = { ...groupOf(), children: groupOf().children.slice(0, 1) };

    render(<AutoAgentGroup group={group} isCompact />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    screen.getByText('Found 2 doc mismatches');
  });
});
