// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getSetting, insertSession, insertWorkspace, setSetting } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { runRoutesKey } from '../../startRun/runRoutesSetting';
import { StartRun } from './StartRun';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Refund retries' });
const AGENT = brandId<AgentId>({ value: 'agent-notify-relay' });
const LAYOUT_ID = brandId<WorkflowId>({ value: 'workflow-layout' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const LAYOUT_ASK = 'Fix the layout of the Harborline billing page';
const FIX_A_LAYOUT: Workflow = {
  id: LAYOUT_ID,
  workspaceId: WORKSPACE.id,
  name: 'Fix a layout',
  description: '',
  steps: [
    {
      id: brandId<StepId>({ value: 'step-find' }),
      workflowId: LAYOUT_ID,
      ordinal: 0,
      name: 'Find',
      role: 'scout',
      promptPrefix: '',
    },
    {
      id: brandId<StepId>({ value: 'step-center' }),
      workflowId: LAYOUT_ID,
      ordinal: 1,
      name: 'Center',
      promptPrefix: '',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: NOW,
  updatedAt: NOW,
};

let useAppStore: StoryStore;

type SpawnFn = ReturnType<StoryStore['getState']>['spawnAgent'];

const field = () => screen.getByRole('textbox', { name: 'Start a run' });

const suggestionLine = () => document.querySelector('[data-start-suggestion]');

const routeLine = () => document.querySelector('[data-run-route-line]')?.textContent ?? '';

const isFollowPicked = (): boolean =>
  within(screen.getByRole('tablist', { name: 'Plan' }))
    .getByRole('tab', { name: 'Follow a workflow' })
    .getAttribute('aria-selected') === 'true';

const renderField = (): void => {
  render(
    <ToastProvider>
      <StartRun workspaceId={WORKSPACE.id} sessionId={SESSION.id} />
    </ToastProvider>,
  );
};

const storedRoute = async (): Promise<unknown> => {
  const raw = await getSetting(storySqlite(), runRoutesKey({ sessionId: SESSION.id }));
  return JSON.parse(raw ?? '{}')[AGENT];
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
  await insertSession(db, SESSION);
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: { [WORKSPACE.id]: [FIX_A_LAYOUT] },
  });
});

afterEach(cleanup);

describe('StartRun workflow suggestion', () => {
  it('suggests the workflow, then starts a Lead without it', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    const attachWorkflowToSession = vi.fn(async () => undefined);
    useAppStore.setState({ spawnAgent, attachWorkflowToSession });
    renderField();

    fireEvent.change(field(), { target: { value: LAYOUT_ASK } });

    await waitFor(() =>
      expect(suggestionLine()?.textContent).toBe('Looks like your workflow Fix a layout.Use it'),
    );
    expect(routeLine()).not.toContain('Fix a layout');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession).not.toHaveBeenCalled();
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(LAYOUT_ASK);
    expect(await storedRoute()).toMatchObject({ shape: 'lead', presetName: null });
  });

  it('gives a Lead the suggested workflow on Use it, free to change its steps', async () => {
    const spawnAgent = vi.fn<SpawnFn>(async () => AGENT);
    useAppStore.setState({ spawnAgent });
    renderField();

    fireEvent.change(field(), { target: { value: LAYOUT_ASK } });
    fireEvent.click(screen.getByRole('button', { name: 'Use it' }));

    expect(isFollowPicked()).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Keep its steps as written' })).toHaveProperty(
      'checked',
      false,
    );
    expect(suggestionLine()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toBe(
      [
        LAYOUT_ASK,
        'Plan: follow the preset "Fix a layout".',
        '1. Find (scout)\n2. Center',
        'You may add, skip or move a step. Say why when you do.',
      ].join('\n\n'),
    );
    expect(await storedRoute()).toMatchObject({
      row: 1,
      closeness: 'adapt',
      presetName: 'Fix a layout',
    });
  });

  it('still suggests the workflow when an older build saved a lead or plan default', async () => {
    await setSetting(storySqlite(), `runs.defaultShape.${WORKSPACE.id}`, 'lead');
    await setSetting(storySqlite(), `runs.defaultShape.session.${SESSION.id}`, 'plan');
    renderField();

    fireEvent.change(field(), { target: { value: LAYOUT_ASK } });

    await waitFor(() =>
      expect(suggestionLine()?.textContent).toBe('Looks like your workflow Fix a layout.Use it'),
    );
  });

  it('suggests nothing for an ask that fits no workflow', () => {
    renderField();

    fireEvent.change(field(), { target: { value: 'Which notify-relay handler fires twice?' } });

    expect(routeLine()).toContain('A question or a check');
    expect(suggestionLine()).toBeNull();
  });
});
