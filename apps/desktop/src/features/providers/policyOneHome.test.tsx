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
  type ProviderPolicy,
  type WorkflowRules,
  type WorkspaceId,
} from '@goodboy/types';
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

const SPREAD_LABEL = 'Skip a provider near its limit';

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

const openPopover = () => {
  render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);
  fireEvent.click(screen.getByRole('button', { expanded: false, name: /Claude|Cursor/ }));
  return within(screen.getByRole('dialog', { name: 'When a provider is out' }));
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ patch_workspace_overrides: null });
  useAppStore.setState({ loadSetting: vi.fn(async (): Promise<string | null> => null) });
});

afterEach(cleanup);

describe('the provider policy has one home', () => {
  it('writes spreadByHeadroom on the workflow rules from the Providers popover', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    const popover = openPopover();

    const toggle = popover.getByRole('switch', { name: SPREAD_LABEL });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(true));
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
      spreadByHeadroom: true,
      autonomy: DEFAULT_WORKFLOW_RULES.autonomy,
    });
    expect(popover.getByRole('switch', { name: SPREAD_LABEL }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('turns the rule off again through the same switch', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    const popover = openPopover();

    fireEvent.click(popover.getByRole('switch', { name: SPREAD_LABEL }));

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(false));
  });

  it('disables the option and says why when no On provider reports limits', () => {
    seed({ policy: CURSOR_ONLY, rules: { spreadByHeadroom: true } });
    const popover = openPopover();

    const toggle = popover.getByRole('switch', { name: SPREAD_LABEL });
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(
      popover.getByText('Only Claude and Codex report limits. Turn one on to use this.'),
    ).toBeDefined();
  });

  it('says the switch skips a provider past 80% and only Claude and Codex report limits', () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    const popover = openPopover();

    expect(popover.getByTestId('spread-sentence').textContent).toBe(
      'Past 80% of a limit, new agents start on the next provider. Only Claude and Codex report limits.',
    );
  });

  it('says the first On provider does all the work and the rest is the fallback order', () => {
    seed({ policy: POLICY });
    render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);

    expect(
      screen.getByText(
        'Every new agent starts on Claude while Claude can work. Codex and Cursor take over only when it cannot.',
      ),
    ).toBeDefined();
  });

  it('says no other provider takes over when only one is on', () => {
    seed({ policy: CURSOR_ONLY });
    render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);

    expect(
      screen.getByText('Every new agent starts on Cursor. No other provider is on to take over.'),
    ).toBeDefined();
  });

  it('leaves the policy to Models: Runs has no switch, summary or link for it', () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    expect(screen.queryAllByRole('switch')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Open Models' })).toBeNull();
    expect(screen.queryByText('Claude, Codex · Cursor as backup')).toBeNull();
  });

  it('keeps the two screens in step after the policy changes in Providers', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    const popover = openPopover();
    fireEvent.click(popover.getByRole('switch', { name: SPREAD_LABEL }));
    await waitFor(() =>
      expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
        spreadByHeadroom: true,
      }),
    );
    cleanup();

    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    expect(screen.queryAllByRole('switch', { name: SPREAD_LABEL })).toEqual([]);
    cleanup();
    const reopened = openPopover();
    expect(reopened.getByRole('switch', { name: SPREAD_LABEL }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});
