// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type SessionId,
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
import { ToastProvider } from '../../../../shared/components/Toast';
import { WorkflowBuilderView } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const SESSION = aSession({
  id: 's-backoff' as SessionId,
  workspaceId: HARBORLINE.id,
  goal: 'Retry backoff for payments-api',
});

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
      'From your rulesAsk after the plan · $25 cap, pause · Claude, Codex · No guidanceEdit',
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
});
