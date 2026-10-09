// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { sessionPlace } from '../../store/slices/navigation/place';
import { ToastProvider } from '../../shared/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { DrawerHost } from '../../app/components/DrawerHost';
import {
  EXPANDED_THREAD_ID,
  SESSION as RESOLVE_SESSION,
  seedResolveScene,
} from '../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from '../../features/branch/components/BranchPage';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import {
  SETTINGS_WORKSPACE,
  seedSettingsBase,
} from '../../app/components/MockScene/scenes/audit/settingsSeed';
import { OnboardingWizard } from '../../features/onboarding/OnboardingWizard';
import { openWizardStep } from '../../features/onboarding/onboarding-store';
import { SessionDraftPane } from '../../features/session/components/SessionDraftPane';
import { InboxDetail } from '../../features/inbox/components/InboxStudio/InboxDetail';
import type { InboxProvider, InboxRecord } from '../../features/inbox/types';
import { SettingsStudio } from '../../features/settings/components/SettingsStudio';

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

const ISSUE_TITLE = 'The ledger-core importer drops rows with a trailing comma';

const GITHUB_RECORD: InboxRecord = {
  key: 'github:issue:412',
  provider: 'github',
  kind: 'issue',
  identifier: '#412',
  title: ISSUE_TITLE,
  state: 'open',
  stateLabel: 'Open',
  updatedAt: '2026-08-21T09:00:00.000Z',
  url: 'https://example.invalid/acme/ledger-core/issues/412',
  context: 'acme/ledger-core',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 412,
      title: ISSUE_TITLE,
      body: 'Rows that end with a comma never reach the ledger.',
      url: 'https://example.invalid/acme/ledger-core/issues/412',
      state: 'OPEN',
      labels: [],
      updatedAt: '2026-08-21T09:00:00.000Z',
    },
    sessionId: null,
  },
};

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let consoleErrors: Array<string> = [];
let restoreActions: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  consoleErrors = [];
  const logError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    consoleErrors.push(args.map(String).join(' '));
    logError(...args);
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restoreActions);
  restoreActions = {};
  vi.restoreAllMocks();
});

const stubActions = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  const originals = Object.fromEntries(
    Object.keys(actions).map((key) => [key, state[key as keyof StoreState]]),
  );
  restoreActions = { ...originals, ...restoreActions };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mountFlow = async (ui: ReactNode): Promise<void> => {
  render(<ToastProvider>{ui}</ToastProvider>);
  await settle();
};

const expectNoRenderLoop = (): void => {
  expect(consoleErrors.filter((line) => line.includes('Maximum update depth'))).toEqual([]);
};

describe('main flows on the real store', () => {
  it('starts the first session from the onboarding wizard', async () => {
    seedSettingsBase();
    const startSessionFromDraft = vi.fn(async () => ({ id: 'session-started' }) as Session);
    stubActions({ hydrated: true, startSessionFromDraft });

    await mountFlow(<OnboardingWizard />);
    await act(async () => {
      openWizardStep('first-session');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    fireEvent.click(await screen.findByRole('button', { name: /Start Scout/ }));

    await waitFor(() => expect(startSessionFromDraft).toHaveBeenCalledOnce());
    expect(startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: SETTINGS_WORKSPACE.id,
      start: expect.objectContaining({ kind: 'scout' }),
    });
    const projectId = useAppStore.getState().projects[0]?.id ?? null;
    expect(useAppStore.getState().sessionDrafts[SETTINGS_WORKSPACE.id]?.projectId).toBe(projectId);
    expectNoRenderLoop();
  });

  it('starts a session from the new session draft', async () => {
    seedBoardScene();
    const startSessionFromDraft = vi.fn(async () => ({ id: 'session-started' }) as Session);
    stubActions({ startSessionFromDraft });

    await mountFlow(<SessionDraftPane workspaceId={WORKSPACE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Ask an agent/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the ledger-core importer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(startSessionFromDraft).toHaveBeenCalledOnce());
    expect(startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: expect.objectContaining({
        kind: 'scout',
        prompt: expect.stringContaining('the ledger-core importer'),
      }),
    });
    expectNoRenderLoop();
  });

  it('starts an inbox issue in the new session draft with the issue picked', async () => {
    seedBoardScene();
    const requestIssueBrief = vi.fn(async () => undefined);
    const onNewSession = vi.fn();
    window.addEventListener('goodboy:new-session', onNewSession);
    stubActions({
      createSession: vi.fn() as unknown as StoreState['createSession'],
      requestIssueBrief,
    });

    await mountFlow(
      <InboxDetail
        record={GITHUB_RECORD}
        workspaceId={WORKSPACE_ID}
        rootPath="/mock/acme/ledger-core"
        errors={NO_ERRORS}
        onRefresh={() => undefined}
        onClose={() => undefined}
        onDeselect={() => undefined}
        launchFocusRequest={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Start from #412/ }));

    await waitFor(() =>
      expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]).toMatchObject({
        choice: 'task',
        issueKey: 'github:412',
        pickedIssue: expect.objectContaining({ provider: 'github', identifier: '#412' }),
      }),
    );
    expect(requestIssueBrief).toHaveBeenCalledOnce();
    expect(onNewSession).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region', { name: /^Start from/ })).toBeNull();
    window.removeEventListener('goodboy:new-session', onNewSession);
    expectNoRenderLoop();
  });

  it('accepts a review comment in Review without talking to GitHub', async () => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    const acceptResolveQueueItem = vi.fn(async () => undefined);
    const publishConversations = vi.fn(async () => undefined);
    stubActions({
      acceptResolveQueueItem:
        acceptResolveQueueItem as unknown as StoreState['acceptResolveQueueItem'],
      publishConversations: publishConversations as unknown as StoreState['publishConversations'],
    });

    await mountFlow(<BranchPage session={RESOLVE_SESSION} workingDir={null} />);
    const bar = screen.getByRole('toolbar', { name: 'Comment actions' });
    fireEvent.click(within(bar).getByRole('button', { name: /^Accept/ }));

    await waitFor(() => expect(acceptResolveQueueItem).toHaveBeenCalledOnce());
    expect(acceptResolveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: RESOLVE_SESSION.id, revision: 1 }),
    );
    expect(publishConversations).not.toHaveBeenCalled();
    expectNoRenderLoop();
  });

  it('opens the diff from the session trail', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });

    await mountFlow(<KeepAliveWorkSurface sessionId={sessionId} isActive />);
    expect(screen.queryByRole('tab', { name: /^Files/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Session/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /^Branch/ }));
    await settle();
    fireEvent.click(await screen.findByRole('tab', { name: /^Files/ }));
    await settle();

    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');
    expect(useAppStore.getState().branchTab[sessionId]).toBe('files');
    expect(screen.getByRole('tab', { name: /^Files/ }).getAttribute('aria-selected')).toBe('true');
    expectNoRenderLoop();
  });

  it('opens and closes the context drawer from the overview chip', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });

    await mountFlow(
      <>
        <KeepAliveWorkSurface sessionId={sessionId} isActive />
        <DrawerHost />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.click(screen.getByTestId('context-chip'));
    await settle();

    expect(useAppStore.getState().drawer).toEqual(
      expect.objectContaining({ kind: 'context', sessionId }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await settle();

    expect(useAppStore.getState().drawer).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expectNoRenderLoop();
  });

  it('walks from the providers page to one provider page', async () => {
    seedSettingsBase();

    await mountFlow(
      <SettingsStudio
        currentWorkspace={SETTINGS_WORKSPACE}
        focus={{ scope: 'providers' }}
        onScopeChange={() => undefined}
        onClose={() => undefined}
      />,
    );
    const rail = screen.getByRole('list', { name: 'Providers & models settings' });
    expect(screen.queryByRole('heading', { name: 'Claude' })).toBeNull();
    fireEvent.click(within(rail).getByRole('button', { name: /Claude/ }));
    await settle();

    expect(screen.getByRole('heading', { name: 'Claude' })).toBeDefined();
    expectNoRenderLoop();
  });
});
