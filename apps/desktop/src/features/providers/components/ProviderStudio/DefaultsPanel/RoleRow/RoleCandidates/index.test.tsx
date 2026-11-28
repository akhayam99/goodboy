// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MODEL_CATALOGS } from '@goodboy/core/providers';
import { listProviderAgentTurns, type ProviderAgentTurns } from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type ProviderConnectionState,
  type ProviderId,
  type ProviderLimits,
  type ProviderPolicy,
  type ProviderRunId,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { anAgent, aSession, aWorkspace } from '@goodboy/types/testing';
import { SETTING_HIDDEN_MODELS } from '../../../../../../settings/settings';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../../store/storyHarness';
import type { ProviderDisplayInfo } from '../../../../../providers';
import { RoleCandidates } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const IN_ORDER: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'cursor', state: 'on' },
  { id: 'codex', state: 'on' },
];

type InfoParams = {
  readonly id: ProviderId;
};

const providerInfo = ({ id }: InfoParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [] },
  connection: 'connected' satisfies ProviderConnectionState,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

type LimitsParams = {
  readonly id: ProviderId;
  readonly used: number;
};

const limitsOf = ({ id, used }: LimitsParams): ProviderLimits => ({
  providerId: id,
  plan: null,
  status: 'ok',
  windows: [{ kind: 'fiveHour', model: null, status: 'ok', usedFraction: used, resetsAt: null }],
  observedAt: isoNow(),
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SeedParams = {
  readonly isByLoad: boolean;
};

const seed = ({ isByLoad }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: (['anthropic', 'cursor', 'codex'] as const).map((id) => providerInfo({ id })),
    providerLimits: {
      anthropic: limitsOf({ id: 'anthropic', used: 0.62 }),
      codex: limitsOf({ id: 'codex', used: 0.18 }),
    },
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        providerPool: IN_ORDER,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: isByLoad },
      },
    },
  });
  return render(
    <RoleCandidates workspaceId={WORKSPACE.id} role="implementer" label="Implementer" />,
  );
};

const startClaudeAgent = () => {
  const session = aSession();
  const runId = brandId<ProviderRunId>({ value: 'run-harborline' });
  const agent = anAgent({ sessionId: session.id, status: 'running', runId });
  act(() => {
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      runRouting: {
        [agent.id]: { [runId]: { provider: 'anthropic', model: 'claude', effort: null } },
      },
    });
  });
};

const bestText = async () => (await rowsByMark()).find((row) => row.mark === 'best')?.text ?? '';

const rowsByMark = async () => {
  const section = within(await screen.findByRole('region', { name: 'Candidates for Implementer' }));
  return section.getAllByRole('listitem').map((item) => ({
    mark: item.getAttribute('data-candidate'),
    text: item.textContent ?? '',
  }));
};

describe('RoleCandidates', () => {
  it('marks Claude under By order and strikes Cursor for an agent that writes code', async () => {
    seed({ isByLoad: false });

    const rows = await rowsByMark();
    const best = rows.filter((row) => row.mark === 'best');
    expect(best).toHaveLength(1);
    expect(best[0]?.text).toContain('is #1 in your order');
    expect(best[0]?.text).toContain('62% used');
    const out = rows.filter((row) => row.mark === 'out');
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((row) =>
        row.text.includes(
          'the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs',
        ),
      ),
    ).toBe(true);
    expect(rows.some((row) => row.text.includes('is #2 in your order'))).toBe(false);
  });

  it('drops a turns read that answers after a newer one', async () => {
    const late: { answer: (turns: ReadonlyArray<ProviderAgentTurns>) => void } = {
      answer: () => undefined,
    };
    vi.mocked(listProviderAgentTurns)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            late.answer = resolve;
          }),
      )
      .mockImplementationOnce(async () => []);
    seed({ isByLoad: false });
    startClaudeAgent();
    await vi.waitFor(async () => {
      expect(await bestText()).toContain('1 agent in the last hour');
    });

    await act(async () => {
      late.answer([
        {
          provider: 'anthropic',
          agentId: brandId<AgentId>({ value: 'agent-scout-harborline' }),
          cleanTurns: 0,
          lastEndedAtMs: Date.now(),
        },
      ]);
    });

    expect(await bestText()).toContain('1 agent in the last hour');
  });

  it('counts an agent that starts without waiting for the next minute', async () => {
    seed({ isByLoad: false });
    expect(await bestText()).toContain('0 agents in the last hour');

    startClaudeAgent();

    expect(await bestText()).toContain('1 agent in the last hour');
  });

  it('moves the mark off a provider whose models get hidden and says why it is left out', async () => {
    seed({ isByLoad: false });
    expect(await bestText()).toContain('is #1 in your order');

    act(() => {
      useAppStore.setState({
        settings: {
          [SETTING_HIDDEN_MODELS]: JSON.stringify({
            anthropic: MODEL_CATALOGS.anthropic.map((model) => model.key),
          }),
        },
      });
    });

    expect(await bestText()).toContain('is #3 in your order');
    const excluded = (await rowsByMark()).filter((row) => row.mark === 'excluded');
    expect(excluded.map((row) => row.text)).toContain('Claudehidden in Settings');
  });

  it('shows nothing from the old workspace while the new turns read is pending', async () => {
    const other = aWorkspace({ name: 'Northwind' });
    const pending: { answer: (turns: ReadonlyArray<ProviderAgentTurns>) => void } = {
      answer: () => undefined,
    };
    const view = seed({ isByLoad: false });
    await rowsByMark();
    vi.mocked(listProviderAgentTurns).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          pending.answer = resolve;
        }),
    );
    act(() => {
      useAppStore.setState((state) => ({
        workspaces: [WORKSPACE, other],
        workspaceOverrides: {
          ...state.workspaceOverrides,
          [other.id]: { ...other.overrides, providerPool: IN_ORDER },
        },
      }));
    });

    view.rerender(<RoleCandidates workspaceId={other.id} role="implementer" label="Implementer" />);

    expect(screen.queryByRole('region', { name: 'Candidates for Implementer' })).toBeNull();
    await act(async () => {
      pending.answer([]);
    });
    expect(await bestText()).toContain('is #1 in your order');
  });

  it('moves the mark to Codex, the provider with the most room left, under By load', async () => {
    seed({ isByLoad: true });

    const rows = await rowsByMark();
    const best = rows.filter((row) => row.mark === 'best');
    expect(best).toHaveLength(1);
    expect(best[0]?.text).toContain('is #3 in your order');
    expect(best[0]?.text).toContain('18% used');
  });
});
