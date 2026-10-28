// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type OverrideSettings,
  type ProviderLimits,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { buildProviderList, type ProviderStatus } from '../../../providers/providers';
import { RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';
import { WorkflowRulesPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const savedRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'patch_workspace_overrides')
    .map(([, args]) => (args as { readonly patch: Partial<OverrideSettings> }).patch.workflowRules);

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

const chip = (label: string) =>
  within(screen.getByRole('group', { name: 'Run defaults' })).getByRole('button', {
    name: new RegExp(`^${label}:`),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ patch_workspace_overrides: null });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    loadSetting: vi.fn(async (): Promise<string | null> => null),
    loadWorkspaceValue: vi.fn(async (): Promise<string | null> => null),
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

const withPool = (providerPool: NonNullable<OverrideSettings['providerPool']>) =>
  useAppStore.setState((state) => ({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...(state.workspaceOverrides[HARBORLINE.id] ?? EMPTY_OVERRIDES),
        providerPool,
      },
    },
  }));

const withRules = (rules: Partial<WorkflowRules>) =>
  useAppStore.setState((state) => ({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        providerPool: state.workspaceOverrides[HARBORLINE.id]?.providerPool ?? null,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, ...rules },
      },
    },
  }));

describe('WorkflowRulesPanel', () => {
  it('starts on the defaults with one chip per setting and the guidance field', () => {
    panel();

    expect(screen.getByRole('heading', { level: 2, name: 'Run defaults' })).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: 'Run defaults' }))
        .getAllByRole('button')
        .map((chip) => chip.getAttribute('aria-label')),
    ).toEqual([
      'Asks you: Every step, new runs',
      'Limit: none, new runs',
      'Models: Claude, Codex · Cursor as backup, new runs',
      'Auto limit: none',
    ]);
    expect(screen.getByRole('textbox', { name: 'Guidance' })).toBeDefined();
  });

  it('opens one popover per chip, the same as on a run, with no Save', () => {
    panel();

    fireEvent.click(chip('Asks you'));
    const popover = screen.getByRole('dialog', { name: 'Asks you' });
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(RUN_AUTONOMY_OPTIONS.map((option) => option.label));
    expect(within(popover).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('saves Asks you for new runs as soon as you pick it', async () => {
    panel();

    fireEvent.click(chip('Asks you'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Asks you' })).getByRole('tab', {
        name: /After the plan/,
      }),
    );

    await waitFor(() => expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['plan']));
    expect(useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.workflowRules?.autonomy).toBe(
      'plan',
    );
  });

  it('reaches new runs only: a run already going keeps its own copy', async () => {
    const run = aWorkflowRun({
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step', spendLimitUsd: 5 },
    });
    useAppStore.setState({
      sessions: [aSession({ workspaceId: HARBORLINE.id, workflowRuns: [run] })],
    });
    panel();

    fireEvent.click(chip('Asks you'));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Asks you' })).getByRole('tab', {
        name: /^Never/,
      }),
    );

    await waitFor(() => expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['run']));
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.rulesSnapshot).toMatchObject({
      autonomy: 'step',
      spendLimitUsd: 5,
    });
  });

  it('applies the limit for new runs on Enter and the behaviour at the limit on click', async () => {
    panel();

    fireEvent.click(chip('Limit'));
    const popover = screen.getByRole('dialog', { name: 'Limit' });
    fireEvent.change(within(popover).getByLabelText('Limit in dollars'), {
      target: { value: '40' },
    });
    fireEvent.submit(within(popover).getByRole('form', { name: 'Limit for new runs' }));
    await waitFor(() => expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40 }));
    fireEvent.click(within(popover).getByRole('tab', { name: 'Warn only' }));

    await waitFor(() =>
      expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40, spendLimitMode: 'notify' }),
    );
  });

  it('opens Providers and models from the Models chip', () => {
    const received: Array<unknown> = [];
    const listener = (event: Event) => received.push((event as CustomEvent).detail);
    window.addEventListener('goodboy:open-settings', listener);
    panel();

    fireEvent.click(chip('Models'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Providers and models' }));
    window.removeEventListener('goodboy:open-settings', listener);

    expect(received).toEqual([{ scope: 'providers', section: undefined }]);
  });

  it('shows the policy in one line, with no switch and no provider list', () => {
    panel();

    fireEvent.click(chip('Models'));
    const popover = screen.getByRole('dialog', { name: 'Models' });
    expect(within(popover).queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByTestId('rules-policy-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
    expect(popover.textContent).not.toMatch(/most room|room left/);
  });

  it('saves guidance, polishes it into one rule per line and undoes the polish', async () => {
    const polished = '- Group the commits by concern at the end.\n- Open the PR as a draft.';
    stubStoryInvoke({
      patch_workspace_overrides: null,
      summarize_session: {
        stdout: JSON.stringify({ result: `<<guidance>>\n${polished}\n<</guidance>>` }),
        stderr: '',
        exitCode: 0,
      },
    });
    panel();
    const field = screen.getByRole('textbox', { name: 'Guidance' });

    fireEvent.change(field, { target: { value: 'cluster commits at the end. open PR as draft' } });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(savedRules().at(-1)?.standingGuidance).toBe(
        'cluster commits at the end. open PR as draft',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Polish guidance' }));

    await waitFor(() => expect(savedRules().at(-1)?.standingGuidance).toBe(polished));
    expect(screen.getByText('Implementer, Docs').parentElement?.textContent).toBe(
      'Goes to the planning agent and to Implementer, Docs',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo guidance change' }));
    await waitFor(() =>
      expect(savedRules().at(-1)?.standingGuidance).toBe(
        'cluster commits at the end. open PR as draft',
      ),
    );
  });

  it('shows no routing line while guidance is empty', () => {
    panel();

    expect(screen.queryByText(/Goes to the planning agent/)).toBeNull();
    expect(screen.queryByText(/Nothing to send yet/)).toBeNull();
  });

  it('adds the tester to the roles only when you pick it', async () => {
    withRules({ standingGuidance: '- Open the PR as a draft.' });
    panel();

    const guidance = screen.getByRole('region', { name: 'Guidance' });
    expect(within(guidance).queryByRole('button', { name: 'About you' })).toBeNull();
    fireEvent.click(within(guidance).getByRole('button', { name: 'Edit', expanded: false }));
    expect(within(guidance).getByRole('button', { name: 'About you' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tester' }));

    await waitFor(() =>
      expect(savedRules().at(-1)?.guidanceRoles).toEqual(['implementer', 'docs', 'tester']),
    );
  });
});
