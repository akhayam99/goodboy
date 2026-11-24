// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type OverrideSettings,
  type ProviderConnectionState,
  type ProviderId,
  type ProviderLimits,
  type ProviderPolicy,
  type WorkflowRules,
  type WorkspaceId,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { WorkflowRulesPanel } from '../workflows/components/WorkflowRulesPanel';
import { ProvidersInOrder } from './components/ProviderStudio/DefaultsPanel/ProvidersInOrder';
import type { ProviderDisplayInfo } from './providers';

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });

const RULE_LABEL = 'Provider priority';

const ORDER_LABEL = 'Provider order';

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
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

const POLICY: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
  { id: 'cursor', state: 'backup' },
];

const CURSOR_ONLY: ProviderPolicy = [{ id: 'cursor', state: 'on' }];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly policy: ProviderPolicy;
  readonly rules?: Partial<WorkflowRules>;
};

const seed = ({ policy, rules }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: (['anthropic', 'codex', 'cursor'] as const).map((id) => providerInfo({ id })),
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        providerPool: policy,
        ...(rules !== undefined && { workflowRules: { ...DEFAULT_WORKFLOW_RULES, ...rules } }),
      },
    },
  });
};

const writtenRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'patch_workspace_overrides')
    .map(([, args]) => (args as { readonly patch: Partial<OverrideSettings> }).patch.workflowRules);

type TabParams = {
  readonly name: 'By order' | 'By load';
};

const ruleTab = ({ name }: TabParams) =>
  within(screen.getByRole('tablist', { name: RULE_LABEL })).getByRole('tab', { name });

const renderRows = () => render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);

const CLAUDE_AT_62: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'ok',
  windows: [{ kind: 'fiveHour', model: null, status: 'ok', usedFraction: 0.62, resetsAt: null }],
  observedAt: isoNow(),
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ patch_workspace_overrides: null });
  useAppStore.setState({ loadSetting: vi.fn(async (): Promise<string | null> => null) });
});

afterEach(cleanup);

describe('the provider policy has one home', () => {
  it('writes spreadByHeadroom true when Provider priority moves to By load', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    renderRows();

    expect(ruleTab({ name: 'By order' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(ruleTab({ name: 'By load' }));

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(true));
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
      spreadByHeadroom: true,
      autonomy: DEFAULT_WORKFLOW_RULES.autonomy,
    });
    expect(ruleTab({ name: 'By load' }).getAttribute('aria-selected')).toBe('true');
  });

  it('writes spreadByHeadroom false when Provider priority moves back to By order', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    renderRows();

    fireEvent.click(ruleTab({ name: 'By order' }));

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(false));
  });

  it('keeps By order and reports the error when the write fails', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    stubStoryInvoke({
      patch_workspace_overrides: () => {
        throw new Error('settings file is locked');
      },
    });
    renderRows();

    fireEvent.click(ruleTab({ name: 'By load' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't save the provider priority" }),
      ),
    );
    expect(
      useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules?.spreadByHeadroom,
    ).toBe(false);
    expect(ruleTab({ name: 'By order' }).getAttribute('aria-selected')).toBe('true');
  });

  it('starts a workspace with no saved rules on By order', () => {
    seed({ policy: POLICY });
    renderRows();

    expect(ruleTab({ name: 'By order' }).getAttribute('aria-selected')).toBe('true');
    screen.getByText(
      'Your provider order wins when several providers fit. Applies from the next agent. A run started from a workflow keeps its rule.',
    );
  });

  it('says the provider with the most room left wins under By load', () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    renderRows();

    screen.getByText(
      'The provider with the most room left wins when several fit. Applies from the next agent. A run started from a workflow keeps its rule.',
    );
  });

  it('says the Lead reads the order and Backup waits, without claiming the first takes every agent', () => {
    seed({ policy: POLICY });
    renderRows();

    screen.getByText(
      'The Lead reads this order when it picks a provider for a new agent. Backup runs only when no On provider can work.',
    );
    expect(screen.queryByText(/Every new agent starts on Claude while/)).toBeNull();
  });

  it('says every new agent starts on the one provider that is on', () => {
    seed({ policy: CURSOR_ONLY });
    renderRows();

    screen.getByText('Only Cursor is on, so every new agent starts there.');
  });

  it('shows the room of each provider and says which ones are estimated', async () => {
    seed({ policy: POLICY });
    useAppStore.setState({ providerLimits: { anthropic: CLAUDE_AT_62 } });
    renderRows();

    const room = within(await screen.findByRole('list', { name: 'Room right now' }));
    const rows = room.getAllByRole('listitem').map((item) => item.textContent);
    expect(rows).toEqual([
      '1Claude62% used',
      '2Codexabout 50% used, estimated',
      '3Cursorabout 50% used, estimated',
    ]);
    screen.getByText(
      'The Lead sees these numbers when it picks a provider. Codex and Cursor have no usage reading, so Goodboy estimates it from recent turns and rate limits.',
    );
  });

  it('counts the agents of the last 5 hours per provider in your order', async () => {
    seed({ policy: POLICY });
    renderRows();

    expect((await screen.findByTestId('last-hours')).textContent).toBe(
      'Claude 0 · Codex 0 · Cursor 0',
    );
  });

  it('lists what a pick can never land on, writers on Cursor included', () => {
    seed({ policy: POLICY });
    renderRows();

    const guards = within(screen.getByRole('list', { name: 'Never picked' }));
    expect(guards.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'A provider that is Off, not connected, at its limit or cooling down',
      'A provider past its budget',
      'An agent that writes code on Cursor',
      "A model outside a role's pinned models",
    ]);
  });

  it('leaves the policy to Models: Runs has no rule, summary or link for it', () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    expect(screen.queryByRole('tablist', { name: RULE_LABEL })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Models' })).toBeNull();
    expect(screen.queryByText('Claude, Codex · Cursor as backup')).toBeNull();
  });

  it('keeps the two screens in step after the rule changes in Providers', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    renderRows();
    fireEvent.click(ruleTab({ name: 'By load' }));
    await waitFor(() =>
      expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
        spreadByHeadroom: true,
      }),
    );
    cleanup();

    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    expect(screen.queryByRole('tablist', { name: RULE_LABEL })).toBeNull();
    cleanup();
    renderRows();
    expect(ruleTab({ name: 'By load' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the policy list in the popover named Provider order', () => {
    seed({ policy: POLICY });
    renderRows();
    fireEvent.click(screen.getByRole('button', { expanded: false, name: /Claude/ }));

    screen.getByRole('dialog', { name: ORDER_LABEL });
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
