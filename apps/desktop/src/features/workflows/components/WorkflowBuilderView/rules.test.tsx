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
  type SessionId,
  type WorkflowId,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import { aSession, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import type { Mode } from '../../../../store/slices/workflowDrafts/types';
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

type OpenBuilderParams = {
  readonly mode?: Mode;
};

const openBuilder = ({ mode = 'dynamic' }: OpenBuilderParams = {}) =>
  render(
    <ToastProvider>
      <WorkflowBuilderView mode={mode} session={SESSION} onClose={() => undefined} />
    </ToastProvider>,
  );

const autonomyChip = () => screen.getByRole('button', { name: /^Autonomy:/ });
const spendChip = () => screen.getByRole('button', { name: /^Limit:/ });

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
  it('opens a new builder from the rules and shows no From your rules row while nothing differs', () => {
    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('Autonomy: Balanced');
    expect(autonomyChip().textContent).toBe('AutonomyBalanced');
    expect(spendChip().getAttribute('aria-label')).toBe('Limit: $25.00 · Pause');
    expect(screen.queryByTestId('from-your-rules')).toBeNull();
    expect(screen.queryByRole('img', { name: /Run defaults/ })).toBeNull();
  });

  it('shows a changed rule in the next builder it opens', () => {
    openBuilder();
    cleanup();
    seedRules({ ...RULES, autonomy: 'run', spendLimitUsd: null });

    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('Autonomy: Autopilot');
    expect(spendChip().getAttribute('aria-label')).toBe('Limit: None');
    expect(screen.queryByTestId('from-your-rules')).toBeNull();
  });

  it('marks a run control that leaves the rules and resets it to them', () => {
    openBuilder();

    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('radio', { name: /Ask me/ }));

    expect(screen.getByRole('img', { name: 'Run defaults: Balanced' })).toBeDefined();
    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));

    expect(autonomyChip().getAttribute('aria-label')).toBe('Autonomy: Balanced');
    expect(screen.queryByRole('img', { name: /Run defaults/ })).toBeNull();
  });

  it('shows the first two guidance lines from the rules at once, with the From your rules badge', () => {
    seedRules({ ...RULES, standingGuidance: GUIDANCE });
    openBuilder();

    const region = within(screen.getByRole('region', { name: 'Guidance' }));
    expect(region.getByText('From your rules')).toBeDefined();
    expect(region.getByTestId('guidance-preview').textContent).toBe(GUIDANCE.replace('\n', ''));
    expect(region.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
  });

  it('sends the guidance to the orchestrator and resets an edit to the rules', () => {
    seedRules({ ...RULES, standingGuidance: GUIDANCE });
    openBuilder();

    fireEvent.click(
      within(screen.getByRole('region', { name: 'Guidance' })).getByRole('button', {
        name: 'Edit',
      }),
    );
    const field = screen.getByLabelText('Run guidance');
    expect((field as HTMLTextAreaElement).value).toBe(GUIDANCE);
    expect(screen.getByTestId('guidance-tools').textContent).toContain('From your rules');
    expect(screen.getByText('the orchestrator').parentElement?.textContent).toBe(
      'Sent to the orchestrator',
    );

    fireEvent.change(field, { target: { value: `${GUIDANCE}\n- Keep the diff small.` } });
    expect(screen.getByTestId('guidance-tools').textContent).toContain('Edited for this run');
    fireEvent.click(
      within(screen.getByTestId('guidance-tools')).getByRole('button', { name: /Reset/ }),
    );

    expect((screen.getByLabelText('Run guidance') as HTMLTextAreaElement).value).toBe(GUIDANCE);
  });

  it('asks for the guidance when the rules hold none', () => {
    openBuilder();

    expect(screen.getByRole('button', { name: /^add guidance/i })).toBeDefined();
    expect(screen.queryByTestId('guidance-preview')).toBeNull();
  });

  it('sends the guidance of a preset run to the roles that write code', () => {
    seedRules({ ...RULES, standingGuidance: GUIDANCE });
    openBuilder({ mode: 'preset' });

    fireEvent.click(
      within(screen.getByRole('region', { name: 'Guidance' })).getByRole('button', {
        name: 'Edit',
      }),
    );

    expect((screen.getByLabelText('Run guidance') as HTMLTextAreaElement).value).toBe(GUIDANCE);
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
    fireEvent.click(screen.getByRole('button', { name: 'Run an orchestrator' }));

    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    expect(autonomyChip().getAttribute('aria-label')).toBe('Autonomy: Balanced');
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
          steps: [],
          autoRun: true,
          title: '',
          orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
          providerPool: null,
        },
      },
    });
    openBuilder();

    expect(autonomyChip().getAttribute('aria-label')).toBe('Autonomy: Balanced');
    expect(screen.queryByTestId('run-changes')).toBeNull();
  });

  it('marks only the changed control with the rule dot, with no rules card', () => {
    openBuilder();

    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('radio', { name: /Autopilot/ }));

    expect(screen.getByRole('img', { name: 'Run defaults: Balanced' })).toBeDefined();
    expect(screen.queryByTestId('from-your-rules')).toBeNull();
    expect(screen.queryByText(/Changed for this run/)).toBeNull();

    fireEvent.click(autonomyChip());
    fireEvent.click(screen.getByRole('button', { name: /Reset to your rule/ }));

    expect(screen.queryByRole('img', { name: /Run defaults/ })).toBeNull();
  });
});
