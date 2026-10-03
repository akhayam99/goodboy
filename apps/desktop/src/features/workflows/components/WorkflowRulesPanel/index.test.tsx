// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type OverrideSettings,
  type ProviderLimits,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import { aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { buildProviderList, type ProviderStatus } from '../../../providers/providers';
import { WorkflowRulesPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const savedRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'set_workspace_overrides')
    .map(([, args]) => (args as { readonly overrides: OverrideSettings }).overrides.workflowRules);

const installed = (id: string): ProviderStatus => ({
  id,
  binary: id,
  available: true,
  version: '1.0.0',
  error: null,
});

const signedIn = { state: 'connected', identity: 'mara@harborline.test' } as const;

const connectedProviders = () => ({
  providers: buildProviderList(
    {
      anthropic: installed('claude'),
      cursor: installed('cursor-agent'),
      codex: installed('codex'),
      gemini: null,
      opencode: null,
      openrouter: null,
      moonshot: null,
    },
    { anthropic: signedIn, cursor: signedIn, codex: signedIn },
  ),
});

const claudeAt = ({ used }: { readonly used: number }): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: used,
      resetsAt: new Date(Date.now() + 3_600_000).toISOString() as IsoDateTime,
    },
  ],
  observedAt: new Date().toISOString() as IsoDateTime,
});

const panel = () => render(<WorkflowRulesPanel workspaceId={HARBORLINE.id} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ set_workspace_overrides: null });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    ...connectedProviders(),
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
        ],
      },
    },
  });
});

afterEach(cleanup);

describe('WorkflowRulesPanel', () => {
  it('starts on the defaults and summarises the provider policy it does not own', () => {
    panel();

    expect(screen.getByTestId('rules-provider-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual(
      ['true', 'false', 'false'],
    );
    expect(screen.getByRole('switch', { name: 'Default cap' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('saves the autonomy for new runs as soon as you pick it', async () => {
    panel();

    fireEvent.click(screen.getByRole('radio', { name: /Ask after the plan/ }));

    await waitFor(() => expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['plan']));
    expect(useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.workflowRules?.autonomy).toBe(
      'plan',
    );
    expect(
      screen.getByRole('radio', { name: /Ask after the plan/ }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('turns the default cap on, keeps a typed amount and the behaviour at the limit', async () => {
    panel();

    fireEvent.click(screen.getByRole('switch', { name: 'Default cap' }));
    const amount = await screen.findByRole('textbox', { name: /Amount/ });
    fireEvent.change(amount, { target: { value: '40' } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole('tab', { name: 'Warn only' }));

    await waitFor(() =>
      expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40, spendLimitMode: 'notify' }),
    );
    expect(savedRules()[0]).toMatchObject({ spendLimitUsd: 25, spendLimitMode: 'pause' });
  });

  it('names a tight provider, where the next step goes, and spreads when you turn it on', async () => {
    useAppStore.setState((state) => ({
      providerLimits: { anthropic: claudeAt({ used: 0.85 }) },
      workspaceOverrides: {
        [HARBORLINE.id]: {
          ...EMPTY_OVERRIDES,
          providerPool: state.workspaceOverrides[HARBORLINE.id]?.providerPool ?? null,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false },
        },
      },
    }));
    panel();

    expect(screen.getByText('Claude 85% used')).toBeDefined();
    expect(screen.getByTestId('rules-next-pick').textContent).toBe(
      'A step with no pinned provider goes to ClaudeFirst in your order.',
    );
    expect(screen.getByText(/Spreading would send new steps to Codex first/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(savedRules().at(-1)?.spreadByHeadroom).toBe(true));
    expect(screen.getByTestId('rules-next-pick').textContent).toBe(
      'A step with no pinned provider goes to CodexClaude is at 85%, so it goes last.',
    );
    expect(screen.queryByRole('button', { name: 'Turn on' })).toBeNull();
  });
});
