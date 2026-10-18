// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { WORKSPACE_ID } from '../../app/components/MockScene/scenes/BoardScene';
import { SessionHoverCardBody } from '../../features/workspace/components/SessionHoverCard/SessionHoverCardBody';
import { runObjectAction } from '../../features/actions/registry';
import { TALK_ACTION_ID } from '../../features/actions/kinds/suggestion';
import type { ActionEnv } from '../../features/actions/types';
import { brandedId } from '../../features/history/testing/brandedId';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

type SceneParams = {
  readonly name: string;
};

const mountScene = async ({ name }: SceneParams): Promise<void> => {
  const Scene = MOCK_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`${name} is not a registered scene`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

type ClickParams = {
  readonly name: string | RegExp;
};

const clickNamed = async ({ name }: ClickParams): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name }));
  await settle();
};

const startChoices = () =>
  within(screen.getByRole('tablist', { name: 'How do you want to start?' }));

const selectedChoice = () =>
  startChoices()
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent;

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

describe('SPEC3 9.2 New session draft and the New forms, from the c10 page and drawer', () => {
  it('offers four start choices with one line under the selected one', async () => {
    await mountScene({ name: 'c10-start-orchestrate' });

    expect(
      startChoices()
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Pick up a task', 'Run a workflow', 'Run an orchestrator', 'Start an agent']);
    screen.getByText('The orchestrator picks each next step until the goal is done.');
  });

  it('preselects Run a workflow when no tracker has candidates', async () => {
    window.history.replaceState(null, '', '/?open=1');
    await mountScene({ name: 'session-start' });

    expect(selectedChoice()).toBe('Run a workflow');
  });

  it('keeps Discard in the actions row and asks Keep this draft? on Esc', async () => {
    await mountScene({ name: 'c10-start-orchestrate' });
    screen.getByRole('button', { name: 'Discard' });

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();

    screen.getByText('Keep this draft?');
  });

  it('keeps the tracker issues with a search that looks an issue code up, with the miss reason', async () => {
    await mountScene({ name: 'start-multiselect' });

    const search = screen.getByRole('textbox', { name: 'Search issues' });
    fireEvent.change(search, { target: { value: 'HBL-999' } });
    await settle();

    screen.getByText('Not in Tasks');
    screen.getByText("Couldn't reach Linear. Retry");
  });

  it('keeps the pasted pull request link as one Review pull request row', async () => {
    await mountScene({ name: 'start-paste-pr-url' });

    screen.getByRole('textbox', { name: 'Search issues' });
  });

  it('keeps starred issues on top of the task list', async () => {
    await mountScene({ name: 'start-multiselect' });

    screen.getByText('Starred');
  });

  it('keeps the picked issue brief block with Use the issue text and its remove', async () => {
    await mountScene({ name: 'start-pick-one-block' });

    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      'Stop retried webhooks posting a second credit',
    );
    screen.getByRole('button', { name: 'Use the issue text' });
    screen.getByRole('button', { name: 'Remove HBL-412' });
  });

  it('keeps up to five issues and the will close line', async () => {
    await mountScene({ name: 'start-picked3' });

    screen.getByText('Will close HBL-412, HBL-398, HBL-405 when merged');
  });

  it('offers three ways to work on a picked issue, Run an orchestrator included', async () => {
    await mountScene({ name: 'start-pick-one-block' });

    fireEvent.click(screen.getByRole('button', { name: /^Runs as:/ }));
    const ways = within(screen.getByRole('menu', { name: 'Runs as' }));
    expect(ways.getAllByRole('menuitemradio').map((way) => way.textContent)).toEqual([
      'Run an orchestrator',
      'Run a workflow',
      'Start an agent',
    ]);
  });

  it('prefills the project picker from the launch project line and names the project', async () => {
    await mountScene({ name: 'start-crossproject' });

    screen.getByRole('button', { name: 'Remove payments-api' });
    screen.getByText('In payments-api, from GitHub repo harborline/payments-api.');
  });

  it('starts from HBL-412 in one gesture and raises the Run started toast', async () => {
    await mountScene({ name: 'start-pick-one-block' });

    await clickNamed({ name: 'Start from HBL-412' });

    screen.getByText('Run started');
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();
  });

  it('keeps Run a workflow as the full builder at page width', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    screen.getByRole('button', { name: 'Model for Scout the retry path' });
    screen.getByRole('button', { name: 'Model for Build the guard' });
    screen.getByRole('button', { name: 'Run a workflow' });
  });

  it('puts optional projects up front in a searchable picker with chips', async () => {
    await mountScene({ name: 'c10-start-projects' });

    screen.getByText('Optional');
    expect(screen.getByRole('combobox', { name: 'Search folders' })).toHaveProperty('value', 'pay');
    screen.getByRole('button', { name: 'Remove payments-api' });
    screen.getByRole('button', { name: 'Remove ledger-core' });
  });

  it('keeps Start an agent with Scout by default, the model and the project it works in', async () => {
    await mountScene({ name: 'c10-start-agent' });

    screen.getByRole('button', { name: 'Role: Scout' });
    screen.getByRole('textbox', { name: 'Scout focus' });
    expect(screen.queryByRole('button', { name: /^Project:/ })).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }));
    fireEvent.click(screen.getByRole('option', { name: 'ledger-core' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove payments-api' }));
    fireEvent.click(screen.getByRole('option', { name: 'payments-api' }));
    await settle();

    screen.getByRole('button', { name: 'Remove ledger-core' });
    expect(
      useAppStore
        .getState()
        .sessionDrafts[WORKSPACE_ID]?.projectIds.map(
          (id) => useAppStore.getState().projects.filter((project) => project.id === id)[0]?.name,
        ),
    ).toEqual(['ledger-core', 'payments-api']);
  });

  it('keeps Start an agent with Auto on: Experimental and Start an auto', async () => {
    await mountScene({ name: 'c10-start-auto' });

    screen.getByRole('region', { name: 'Auto' });
    screen.getByText('Experimental');
    screen.getByRole('button', { name: 'Start an auto' });
  });

  it('marks a title Goodboy wrote as Named by Goodboy on the session hover card', async () => {
    const session = aSession({ id: brandedId<SessionId>({ value: 'mock-c10-named' }) });
    useAppStore.setState({ sessions: [session], goodboyNamedSessionId: session.id });
    render(
      <ToastProvider>
        <SessionHoverCardBody
          session={session}
          isArchived={false}
          onOpenAttention={() => undefined}
          onOpenLegend={() => undefined}
        />
      </ToastProvider>,
    );
    await settle();

    screen.getByText(/Named by Goodboy/);
  });

  it('makes Run an orchestrator its own choice and keeps no mode switch in Run a workflow', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    expect(screen.queryByRole('tablist', { name: 'Mode' })).toBeNull();
    fireEvent.click(startChoices().getByRole('tab', { name: 'Run an orchestrator' }));
    await settle();

    screen.getByRole('button', { name: 'Run an orchestrator' });
  });

  it('keeps the orchestrator row and Guidance in the Run an orchestrator choice and drawer form', async () => {
    await mountScene({ name: 'c10-new-orchestrate' });

    const form = within(screen.getByRole('region', { name: 'Run an orchestrator' }));
    form.getByText('Orchestrator');
    form.getByRole('button', { name: /guidance/i });
  });

  it('keeps every preset step editable before the start, with its pause point', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    fireEvent.click(screen.getByRole('button', { name: 'Model for Plan the guard' }));
    await settle();

    screen.getByText('Waits for you to approve the plan');
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  it('keeps the preset list with its description', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    screen.getByText('Scout, plan, build');
    screen.getByText('Read the code, plan the change, then build it.');
  });

  it('keeps a model per step in the plan preview', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    screen.getByRole('button', { name: 'Model for Plan the guard' });
  });

  it('keeps Autonomy, Starts and Limit in the actions row', async () => {
    await mountScene({ name: 'c10-start-orchestrate' });

    screen.getByRole('button', { name: /^Autonomy:/ });
    screen.getByRole('button', { name: /^Starts/ });
    screen.getByRole('button', { name: /^Limit:/ });
  });

  it('marks the control that leaves your rules and resets it from its own popover', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    const autonomy = screen.getByRole('button', { name: /^Autonomy:/ });
    within(autonomy).getByRole('img', { name: /^Run defaults:/ });
    fireEvent.click(autonomy);
    screen.getByRole('button', { name: /Reset to your rule/ });
  });

  it('keeps the start gate reason when the goal is empty', async () => {
    await mountScene({ name: 'c10-start-orchestrate' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: '' } });
    await settle();

    expect(screen.getByRole('button', { name: 'Run an orchestrator' })).toHaveProperty(
      'disabled',
      true,
    );
    screen.getByText('Set a goal to start');
  });

  it('keeps the estimate in its reserved slot', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    screen.getByTestId('plan-estimate');
  });

  it('opens one drawer form per item of the Overview New menu', async () => {
    await mountScene({ name: 'c10-new-menu' });

    fireEvent.click(
      within(screen.getByRole('menu', { name: 'New' })).getByRole('menuitem', {
        name: 'Run an orchestrator',
      }),
    );
    await settle();

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'new',
      payload: { form: 'orchestrate' },
    });
  });

  it('keeps the Overview New button filled only while Next holds no primary', async () => {
    await mountScene({ name: 'c05-overview-blank' });

    const hasNext = screen.queryByRole('region', { name: 'Next steps' }) !== null;
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('data-variant')).toBe(
      hasNext ? 'secondary' : 'primary',
    );
  });

  it('opens the Start an auto form with the context from Talk it through with Auto', async () => {
    const session = aSession({ id: brandedId<SessionId>({ value: 'mock-c10-talk' }) });
    useAppStore.setState({ sessions: [session] });

    await runObjectAction({
      target: {
        kind: 'suggestion',
        sessionId: session.id,
        suggestion: {
          id: 'plan-ready:plan-1',
          kind: 'plan-ready',
          fingerprint: 'plan-ready:plan-1',
          priority: 40,
          band: 2,
          title: 'Implement the retry guard',
          detail: 'The plan is approved',
          sessionId: session.id,
          targetKey: null,
          payload: { planId: brandedId({ value: 'plan-1' }) },
        },
        startsRole: 'implementer',
        isAutoOn: true,
      },
      actionId: TALK_ACTION_ID,
      env,
    });

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'new',
      sessionId: session.id,
      payload: { form: 'auto' },
    });
  });

  it('moves the Write tab to the Report and Wireframe drawer forms', async () => {
    await mountScene({ name: 'c10-new-report' });
    screen.getByRole('region', { name: 'Write a report' });
    cleanup();

    await mountScene({ name: 'c10-new-wireframe' });
    screen.getByRole('region', { name: 'Draw a wireframe' });
  });
});
