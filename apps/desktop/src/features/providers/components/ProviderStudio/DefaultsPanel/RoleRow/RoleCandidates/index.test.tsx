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
import { listProviderAgentTurns, type ProviderAgentTurns } from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type ProviderConnectionState,
  type ProviderId,
  type ProviderLimits,
  type ProviderPolicy,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { aWorkspace } from '@goodboy/types/testing';
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
  render(<RoleCandidates workspaceId={WORKSPACE.id} role="implementer" label="Implementer" />);
};

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
    expect(best[0]?.text).toContain('#1 in your order');
    expect(best[0]?.text).toContain('62% used');
    const out = rows.filter((row) => row.mark === 'out');
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((row) => row.text.includes('agents that write code do not run here yet')),
    ).toBe(true);
    expect(rows.some((row) => row.text.includes('#2 in your order'))).toBe(false);
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
    act(() => {
      useAppStore.setState({ providerStrikes: {} });
    });
    const before = await rowsByMark();
    expect(before.find((row) => row.mark === 'best')?.text).toContain('0 agents in the last hour');

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

    const after = await rowsByMark();
    expect(after.find((row) => row.mark === 'best')?.text).toContain('0 agents in the last hour');
  });

  it('moves the mark to Codex, the provider with the most room left, under By load', async () => {
    seed({ isByLoad: true });

    const rows = await rowsByMark();
    const best = rows.filter((row) => row.mark === 'best');
    expect(best).toHaveLength(1);
    expect(best[0]?.text).toContain('#3 in your order');
    expect(best[0]?.text).toContain('18% used');
  });
});
