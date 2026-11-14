// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { AutoPhase } from '@goodboy/db';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { WORK_FILTERS, type WorkFilter, type WorkLead } from '../../../../store/slices/work/state';
import { aView } from '../../../auto/testing/autoViewFixtures';
import { WorkPage } from '.';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(() => {
  cleanup();
});

type LeadParams = {
  readonly key: string;
  readonly phase: AutoPhase;
};

const leadOf = ({ key, phase }: LeadParams): WorkLead => {
  const base = aView({ phase, rootAsk: `Ask ${key}` });
  const treeId = brandId<AutoTreeId>({ value: `tree-${key}` });
  return {
    treeId,
    sessionId: brandId<SessionId>({ value: `session-${key}` }),
    sessionGoal: `Goal ${key}`,
    projectId: null,
    branches: [],
    view: {
      ...base,
      tree: {
        ...base.tree,
        id: treeId,
        rootAgentId: brandId<AgentId>({ value: `agent-${key}` }),
        updatedAt: key.charCodeAt(0),
      },
    },
  };
};

const LEADS = [
  leadOf({ key: 'a', phase: 'blocked' }),
  leadOf({ key: 'b', phase: 'answering' }),
  leadOf({ key: 'c', phase: 'finished' }),
  leadOf({ key: 'd', phase: 'finished' }),
];

const seed = (): void => {
  useAppStore.setState({
    loadWorkLeads: async () => undefined,
    workLeads: LEADS,
    workWorkspaceId: WS,
    isWorkStale: false,
    settings: { 'work.enabled': 'true' },
    agentTurnState: {},
  });
};

type ShowParams = {
  readonly filter: WorkFilter;
  readonly onFilterChange?: (filter: WorkFilter) => void;
};

const show = ({ filter, onFilterChange = vi.fn() }: ShowParams) =>
  render(
    <WorkPage workspaceId={WS} filter={filter} onFilterChange={onFilterChange} startWork={null} />,
  );

const FILTER_LABELS = {
  open: 'All open',
  needsYou: 'Needs you',
  working: 'Working',
  finished: 'Finished',
} as const satisfies Readonly<Record<WorkFilter, string>>;

describe('the Work page', () => {
  it('shows as many rows as the count of the filter it is on', () => {
    seed();
    for (const filter of WORK_FILTERS) {
      const view = show({ filter });
      const tab = screen.getByRole('tab', { name: new RegExp(`^${FILTER_LABELS[filter]} \\d+$`) });
      const count = Number(tab.textContent?.split(' ').at(-1));

      expect(view.container.querySelectorAll('[data-work-row]')).toHaveLength(count);
      view.unmount();
    }
  });

  it('puts the filter of the window back on a tab press', () => {
    seed();
    const onFilterChange = vi.fn();
    show({ filter: 'open', onFilterChange });

    fireEvent.click(screen.getByRole('tab', { name: /^Finished/ }));

    expect(onFilterChange).toHaveBeenCalledWith('finished');
  });

  it('opens the Lead of the row inside its session', () => {
    seed();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    show({ filter: 'open' });

    fireEvent.click(screen.getByRole('button', { name: 'Open Ask a' }));

    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'session-a', agentId: 'agent-a' },
    });
  });

  it('draws a skeleton before the first read of the workspace', () => {
    seed();
    useAppStore.setState({ workWorkspaceId: null });
    show({ filter: 'open' });

    expect(screen.queryByRole('status', { name: 'Reading Leads' })).not.toBeNull();
  });
});
