// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, ProviderId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';

const { attachedRuns } = vi.hoisted(() => ({
  attachedRuns: { list: [] as ReadonlyArray<unknown> },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../chat/turn', async () =>
  (await import('../../../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../../../permissions/permissions', async () =>
  (await import('../../../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../../providers/providers', async () =>
  (await import('../../../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../../providers/routing', async () =>
  (await import('../../../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../../budget/budget', async () =>
  (await import('../../../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../../skills/skills', async () =>
  (await import('../../../../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../../../workflows/workflows', async () =>
  (await import('../../../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../../worktree/worktree', async () =>
  (await import('../../../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../../../shared/lib/repo', async () =>
  (await import('../../../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../../../plans/plans', async () =>
  (await import('../../../../../../store/storyHarness')).plansModuleMock(),
);
vi.mock('../../../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));
vi.mock('../../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">Start agent</button>,
}));
vi.mock('../../../../hooks/useResolveActivity', () => {
  const activity = { batchByAgentId: new Map(), factsByAgentId: new Map() };
  return { useResolveActivity: () => activity };
});
vi.mock('../../../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attachedRuns.list,
}));
vi.mock('../../../../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => vi.fn(),
}));
vi.mock('../../../../../workflows/useWorkflowAdvanceStates', () => {
  const states = new Map();
  return { useWorkflowAdvanceStates: () => states };
});
vi.mock('../../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('./ActivityFilterPanel', () => ({
  ActivityFilterPanel: () => <button type="button">Filter</button>,
}));

import { TimelinePane } from './index';

const SESSION: Session = aSession({
  id: 'session-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship it',
});

const WORKFLOW = {
  id: 'workflow-1',
  workspaceId: 'ws-1',
  name: 'Ship the checkout fix',
  description: '',
  origin: 'library',
  steps: [1, 2].map((ordinal) => ({
    id: `step-${ordinal}`,
    workflowId: 'workflow-1',
    ordinal: ordinal - 1,
    name: `Step ${ordinal}`,
    promptPrefix: '',
    role: 'implementer',
  })),
  createdAt: '2026-08-20T10:30:00.000Z',
  updatedAt: '2026-08-20T10:30:00.000Z',
};

const RUN = {
  run: {
    id: 'run-1',
    workflowId: 'workflow-1',
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'static',
    createdAt: '2026-08-20T10:30:00.000Z',
  },
  workflow: WORKFLOW,
};

type AgentSeed = {
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly startedAt: string;
  readonly provider?: ProviderId;
  readonly extra?: Partial<Agent>;
};

const agentOf = ({ id, name, ordinal, startedAt, provider, extra = {} }: AgentSeed): Agent =>
  anAgent({
    id: id as Agent['id'],
    sessionId: 'session-1' as SessionId,
    name,
    ordinal,
    status: 'completed',
    startedAt: startedAt as Agent['startedAt'],
    completedAt: startedAt.replace(':00.000Z', ':30.000Z') as Agent['startedAt'],
    ...(provider === undefined ? {} : { providerOverride: provider }),
    ...extra,
  });

const AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    id: 'agent-1',
    name: 'Step 1',
    ordinal: 1,
    startedAt: '2026-08-20T10:31:00.000Z',
    provider: 'anthropic',
    extra: { stepId: 'step-1', workflowRunId: 'run-1' } as Partial<Agent>,
  }),
  agentOf({
    id: 'agent-2',
    name: 'Step 2',
    ordinal: 2,
    startedAt: '2026-08-20T10:32:00.000Z',
    provider: 'codex',
    extra: { stepId: 'step-2', workflowRunId: 'run-1' } as Partial<Agent>,
  }),
  agentOf({
    id: 'solo-0',
    name: 'Solo cursor',
    ordinal: -1,
    startedAt: '2026-08-20T09:00:00.000Z',
    provider: 'cursor',
  }),
  agentOf({
    id: 'solo-1',
    name: 'Solo unrouted',
    ordinal: -2,
    startedAt: '2026-08-20T09:01:00.000Z',
  }),
  agentOf({
    id: 'lead',
    name: 'Implement the banner',
    ordinal: 500,
    startedAt: '2026-08-21T10:00:00.000Z',
    provider: 'gemini',
  }),
  ...(['opencode', 'openrouter', 'moonshot'] as const).map((provider, index) =>
    agentOf({
      id: `sub-${index + 1}`,
      name: `Scout part ${index + 1}`,
      ordinal: 501 + index,
      startedAt: `2026-08-21T10:0${index + 1}:00.000Z`,
      provider,
      extra: { parentAgentId: 'lead' } as Partial<Agent>,
    }),
  ),
];

const rowOf = ({ name }: { readonly name: string }): HTMLElement => {
  const title = document.querySelector(`[title="${name}"]`);
  const row = title?.closest('[data-row-id]');
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no activity row titled ${name}`);
  }
  return row;
};

const slotIn = ({ row }: { readonly row: Element }) => row.querySelector('[data-provider]');

const glyphsIn = ({ row }: { readonly row: HTMLElement }) =>
  slotIn({ row })?.querySelectorAll('svg[aria-hidden="true"]') ?? [];

const providerNameIn = ({ row }: { readonly row: HTMLElement }): string | null =>
  slotIn({ row })?.querySelector('.sr-only')?.textContent ?? null;

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  attachedRuns.list = [RUN];
  store.setState({
    sessionEvents: { [SESSION.id]: [] },
    sessionPhaseRuns: { [SESSION.id]: AGENTS },
  });
});

afterEach(cleanup);

describe('TimelinePane, provider icon on agent rows', () => {
  it('shows a muted, hidden glyph and names the provider on a workflow step agent', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    const row = rowOf({ name: 'Step 1' });

    expect(glyphsIn({ row })).toHaveLength(1);
    expect(providerNameIn({ row })).toBe('Claude');
    expect(slotIn({ row })?.getAttribute('class')).toContain('opacity-40');
    expect(providerNameIn({ row: rowOf({ name: 'Step 2' }) })).toBe('Codex');
  });

  it('shows the glyph before the agent name on a solo agent row', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    const row = rowOf({ name: 'Solo cursor' });
    const glyph = slotIn({ row });
    const title = row.querySelector('[title="Solo cursor"]');

    expect(providerNameIn({ row })).toBe('Cursor');
    expect(
      glyph !== null &&
        title !== null &&
        (glyph.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
  });

  it('puts the provider name in the accessible name of the row button', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    screen.getByRole('button', { name: /Cursor.*Solo cursor/ });
  });

  it('leaves no icon and no empty slot for an agent with no provider', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(slotIn({ row: rowOf({ name: 'Solo unrouted' }) })).toBeNull();
  });

  it('shows the glyph on the subagent rows once the group opens', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    fireEvent.click(screen.getByRole('button', { name: /3 subagents/ }));

    expect(providerNameIn({ row: rowOf({ name: 'Scout part 1' }) })).toBe('OpenCode');
    expect(providerNameIn({ row: rowOf({ name: 'Scout part 2' }) })).toBe('OpenRouter');
    expect(providerNameIn({ row: rowOf({ name: 'Scout part 3' }) })).toBe('Moonshot');
  });

  it('shows no glyph on a run row, which is not an agent', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    const run = document.querySelector('[data-row-id^="run:"]');

    expect(run).not.toBeNull();
    expect(run === null ? 'missing' : slotIn({ row: run })).toBeNull();
  });
});
