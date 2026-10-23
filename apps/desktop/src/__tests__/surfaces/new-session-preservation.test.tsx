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

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

describe('SPEC3 9.2 New session draft and the New forms, after one flow unit 5', () => {
  it('starts from the task, asks the kind, and has no Folders field', async () => {
    await mountScene({ name: 'c10-start-workflow' });

    expect(screen.queryByRole('tablist', { name: 'How do you want to start?' })).toBeNull();
    const kickoff = within(screen.getByRole('region', { name: 'Kickoff' }));
    expect(kickoff.queryByRole('region', { name: 'Folders' })).toBeNull();
    kickoff.getByRole('tablist', { name: 'What kind of run?' });
    expect(kickoff.getByRole('textbox', { name: 'Task' })).toHaveProperty(
      'value',
      'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged',
    );
    expect(kickoff.queryByRole('button', { name: 'Run a workflow' })).toBeNull();
    expect(kickoff.queryByRole('button', { name: /^Start (Scout|an agent|an auto)$/ })).toBeNull();
  });

  it('keeps Discard beside Start and asks Keep this draft? on Esc', async () => {
    await mountScene({ name: 'c10-start-orchestrate' });
    screen.getByRole('button', { name: 'Discard' });

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await settle();

    screen.getByText('Keep this draft?');
  });

  it('keeps folders an optional override behind Where, searchable', async () => {
    await mountScene({ name: 'c10-start-projects' });

    expect(screen.getByRole('combobox', { name: 'Search folders' })).toHaveProperty('value', 'pay');
    expect(screen.getByRole('combobox', { name: 'Where' }).textContent).toContain('2 folders');
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

  it('opens Start a run on Runs from the Overview New menu, with no drawer form', async () => {
    await mountScene({ name: 'c10-new-menu' });

    const menu = within(screen.getByRole('menu', { name: 'New' }));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Start a run',
      'Write a report',
      'Draw a wireframe',
    ]);
    fireEvent.click(menu.getByRole('menuitem', { name: 'Start a run' }));
    await settle();

    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('keeps the Overview New button filled only while Next holds no primary', async () => {
    await mountScene({ name: 'c05-overview-blank' });

    const hasNext = screen.queryByRole('region', { name: 'Next steps' }) !== null;
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('data-variant')).toBe(
      hasNext ? 'secondary' : 'primary',
    );
  });

  it('opens Start a run with the card from Talk it through with Auto, and no drawer', async () => {
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

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[session.id]).toBe('workflows');
  });

  it('moves the Write tab to the Report and Wireframe drawer forms', async () => {
    await mountScene({ name: 'c10-new-report' });
    screen.getByRole('region', { name: 'Write a report' });
    cleanup();

    await mountScene({ name: 'c10-new-wireframe' });
    screen.getByRole('region', { name: 'Draw a wireframe' });
  });
});
