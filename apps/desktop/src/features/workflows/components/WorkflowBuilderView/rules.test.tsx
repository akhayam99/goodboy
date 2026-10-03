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
  type SessionId,
  type WorkflowId,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import { aSession, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { AppStore } from '../../../../store/store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WorkflowBuilderView } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const SESSION = aSession({
  id: 's-backoff' as SessionId,
  workspaceId: HARBORLINE.id,
  goal: 'Retry backoff for payments-api',
});

const GUIDANCE = '- Group the commits by concern at the end.\n- Open the PR as a draft.';

const RULES: WorkflowRules = {
  ...DEFAULT_WORKFLOW_RULES,
  autonomy: 'plan',
  spendLimitUsd: 25,
};

const seedRules = (rules: WorkflowRules) => {
  useAppStore.setState({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        workflowRules: rules,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
        ],
      },
    },
  });
};

const openBuilder = () =>
  render(
    <ToastProvider>
      <WorkflowBuilderView session={SESSION} onClose={() => undefined} />
    </ToastProvider>,
  );

const autonomyChip = () => screen.getByRole('button', { name: /^When to ask:/ });
const spendChip = () => screen.getByRole('button', { name: /^Spend cap:/ });
const fromRules = () => screen.getByTestId('from-your-rules').textContent ?? '';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    sessions: [SESSION],
  });
  seedRules(RULES);
});

afterEach(cleanup);

describe('WorkflowBuilderView and the workflow rules', () => {
  it('opens a new builder from the rules and names them in one line', () => {
    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('When to ask: Ask after the plan');
    expect(spendChip().getAttribute('aria-label')).toBe('Spend cap: $25.00 · Pause');
    expect(fromRules()).toBe(
      'From your rulesAsk after the plan · $25 cap, pause · Claude, Codex · spread on · No guidanceEdit',
    );
    expect(screen.queryByRole('img', { name: /From: Workflow rules/ })).toBeNull();
  });

  it('shows a changed rule in the next builder it opens', () => {
    openBuilder();
    cleanup();
    seedRules({ ...RULES, autonomy: 'run', spendLimitUsd: null });

    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('When to ask: Run on its own');
    expect(spendChip().getAttribute('aria-label')).toBe('Spend cap: None');
    expect(fromRules()).toContain('Run on its own · No spend cap');
  });

  it('marks a run control that leaves the rules and resets it to them', () => {
    openBuilder();

    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('radio', { name: /Ask before each step/ }));

    expect(
      screen.getByRole('img', { name: 'Rules: Ask after the plan · From: Workflow rules' }),
    ).toBeDefined();
    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));

    expect(autonomyChip().getAttribute('aria-label')).toBe('When to ask: Ask after the plan');
    expect(screen.queryByRole('img', { name: /From: Workflow rules/ })).toBeNull();
  });

  it('opens the guidance from the rules, sends it to the orchestrator, and resets an edit', () => {
    seedRules({ ...RULES, standingGuidance: GUIDANCE });
    openBuilder();

    const field = screen.getByLabelText(/guidance \(optional\)/i);
    expect((field as HTMLTextAreaElement).value).toBe(GUIDANCE);
    expect(screen.getByTestId('guidance-tools').textContent).toContain('From your rules');
    expect(screen.getByText('the orchestrator').parentElement?.textContent).toBe(
      'Sent to the orchestrator',
    );

    fireEvent.change(field, { target: { value: `${GUIDANCE}\n- Keep the diff small.` } });
    expect(screen.getByTestId('guidance-tools').textContent).toContain('Edited for this run');
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));

    expect((screen.getByLabelText(/guidance \(optional\)/i) as HTMLTextAreaElement).value).toBe(
      GUIDANCE,
    );
  });

  it('sends the guidance of a custom run to the roles that write code', () => {
    seedRules({ ...RULES, standingGuidance: GUIDANCE });
    openBuilder();

    fireEvent.click(screen.getByRole('tab', { name: /custom/i }));

    expect(
      (screen.getByRole('textbox', { name: 'Run guidance' }) as HTMLTextAreaElement).value,
    ).toBe(GUIDANCE);
    expect(screen.getByText('Implementer, Docs').parentElement?.textContent).toBe(
      'Sent to Implementer, Docs',
    );
  });

  it('starts a run on the rules autonomy when the chip was left alone', async () => {
    const attach = vi.fn<AppStore['attachWorkflowToSession']>(async () => undefined);
    useAppStore.setState({
      attachWorkflowToSession: attach,
      savePhaseTemplate: async (args) => ({
        id: args.id ?? ('wf-backoff' as WorkflowId),
        workspaceId: args.workspaceId,
        name: args.name,
        description: args.description,
        steps: [],
        createdAt: SESSION.createdAt,
        updatedAt: SESSION.createdAt,
      }),
      generateWorkflowTitle: async () => undefined,
    });
    openBuilder();

    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), {
      target: { value: 'Add backoff to the payments-api retry worker' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    expect(autonomyChip().getAttribute('aria-label')).toBe('When to ask: Ask after the plan');
    expect(screen.queryByTestId('run-changes')).toBeNull();
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      autoRun: true,
      rulesSnapshot: { autonomy: 'plan' },
    });
  });

  it('opens a draft saved before the rules on the rules autonomy', () => {
    useAppStore.setState({
      workflowDrafts: {
        [SESSION.id]: {
          mode: 'dynamic',
          goalText: 'Add backoff to the payments-api retry worker',
          goalHistory: [],
          selectedPresetId: null,
          basePresetId: null,
          processText: '',
          plan: null,
          workflow: {
            name: '',
            description: '',
            goal: '',
            steps: [],
            origin: 'custom',
            isPreset: false,
          },
          saveAsPreset: false,
          autoRun: true,
          title: '',
          orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
          providerPool: null,
        },
      },
    });
    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('When to ask: Ask after the plan');
    expect(screen.queryByTestId('run-changes')).toBeNull();
  });

  it('says in the summary when this run asks differently from the rules', () => {
    openBuilder();

    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('radio', { name: /Run on its own/ }));

    expect(screen.getByTestId('run-changes').textContent).toBe('Changed for this run: when to ask');
    expect(fromRules()).toContain('Ask after the plan');
  });
});
