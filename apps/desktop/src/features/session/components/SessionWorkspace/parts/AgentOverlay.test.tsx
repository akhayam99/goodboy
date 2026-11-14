// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type Agent, type AgentId, type SessionId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, turn_quiet: [] });
});

type RunsParams = {
  readonly runs: Record<string, ReadonlyArray<Agent>>;
};

const setRuns = ({ runs }: RunsParams): void => {
  useAppStore.setState({ sessionPhaseRuns: runs });
};

vi.mock('../../AgentDetailPane', () => ({
  AgentDetailPane: () => {
    const [isBriefOpen, setIsBriefOpen] = useState(false);
    return (
      <button type="button" onClick={() => setIsBriefOpen(true)}>
        {isBriefOpen ? 'brief open' : 'brief closed'}
      </button>
    );
  },
}));
import { AgentOverlay } from './AgentOverlay';

const session = aSession();
const sessionId: SessionId = session.id;
const first = anAgent({ id: brandId<AgentId>({ value: 'agent-1' }), sessionId });
const second = anAgent({ id: brandId<AgentId>({ value: 'agent-2' }), sessionId });

afterEach(() => {
  cleanup();
});

describe('AgentOverlay', () => {
  it('keeps the skeleton while the session agents are still loading', () => {
    render(
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={first.id}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText('This agent is no longer in this session')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('agent-header-title-row')).toBeDefined();
  });

  it('offers a way back when the loaded session no longer has the agent', () => {
    setRuns({ runs: { [sessionId]: [] } });
    const onBack = vi.fn();
    render(
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={first.id}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('This agent is no longer in this session')).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('agent-header-title-row')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('starts the next agent with a closed brief and no leftover edit', () => {
    setRuns({ runs: { [sessionId]: [first, second] } });
    const view = (selectedAgentId: AgentId) => (
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={selectedAgentId}
        onBack={vi.fn()}
      />
    );
    const { rerender } = render(view(first.id));
    fireEvent.click(screen.getByRole('button', { name: 'brief closed' }));
    screen.getByRole('button', { name: 'brief open' });

    rerender(view(second.id));

    screen.getByRole('button', { name: 'brief closed' });
  });
});
