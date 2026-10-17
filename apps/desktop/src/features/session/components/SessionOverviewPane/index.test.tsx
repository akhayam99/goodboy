// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
const { renameSession } = vi.hoisted(() => ({
  renameSession: vi.fn(async (..._args: ReadonlyArray<unknown>): Promise<void> => undefined),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({ renameSession }),
);
vi.mock('./HeaderBand', () => ({ HeaderBand: () => <p>Overview goal</p> }));
vi.mock('./ArchivedRestore', () => ({
  ArchivedRestore: () => <button type="button">Restore</button>,
}));
vi.mock('./OverviewNotices', () => ({
  OverviewNotices: () => <section aria-label="Notices" />,
}));
vi.mock('./OverviewActions', () => ({ OverviewActions: () => <button type="button">New</button> }));
vi.mock('../../../suggestions/components/NextStepSlot', () => ({
  NextStepSlot: () => <section aria-label="Next" />,
}));
vi.mock('../SessionWorkspace/parts/TimelinePane', () => ({
  TimelinePane: ({ lead }: { readonly lead: ReactNode }) => (
    <>
      <section aria-label="Needs you" />
      {lead}
      <section aria-label="Activity" />
    </>
  ),
}));

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let SessionOverviewPane: typeof import('./index').SessionOverviewPane;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = 'session-1' as SessionId;

const SESSION: Session = aSession({
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Stop retried webhooks posting a second credit',
});

beforeEach(async () => {
  await resetStoryStore();
  renameSession.mockReset();
  renameSession.mockResolvedValue(undefined);
  useAppStore.setState({
    sessions: [SESSION],
    sessionProjectMounts: { [SESSION_ID]: [] },
    sessionMounts: { [SESSION_ID]: [] },
  });
});

afterEach(cleanup);

type PaneParams = {
  readonly session?: Session;
};

const renderPane = ({ session = SESSION }: PaneParams = {}) =>
  render(<SessionOverviewPane session={session} onSelectLens={vi.fn()} />);

describe('SessionOverviewPane', () => {
  it('stacks goal, notices, Needs you, Next and Activity as body sections in that order', () => {
    const { container } = renderPane();

    const body = container.querySelector('[data-slot="pane-body"]');
    const header = container.querySelector('[data-slot="pane-header"]');
    const names = ['Notices', 'Needs you', 'Next', 'Activity'];
    const sections = names.map((name) => screen.getByRole('region', { name }));
    sections.forEach((section) => expect(section.parentElement).toBe(body));
    expect(Array.from(body?.querySelectorAll(':scope > section') ?? [])).toEqual(sections);
    expect(screen.queryByRole('region', { name: 'Projects' })).toBeNull();
    expect(header?.getAttribute('data-rhythm')).toBe('section');
  });

  it('says what waits on the user only through the Needs you section of the timeline', () => {
    useAppStore.setState({
      sessionOpenQuestions: {
        [SESSION_ID]: [
          {
            id: 'q1' as OpenQuestionId,
            sessionId: SESSION_ID,
            text: 'Which ledger?',
            suggestedAnswers: [],
            isBlocking: false,
            userAnswer: null,
            status: 'open',
            createdAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
          } satisfies OpenQuestion,
        ],
      },
    });
    renderPane();

    expect(screen.getAllByRole('region', { name: 'Needs you' })).toHaveLength(1);
  });

  it('titles the page with the session name, the linked key in mono before it, never Overview', () => {
    const linked: SessionExternalTask = {
      sessionId: SESSION_ID,
      provider: 'linear',
      externalId: 'issue-204',
      identifier: 'HL-204',
      title: 'Stop retried webhooks posting a second credit',
      url: 'https://linear.app/harborline/issue/HL-204',
      createdAt: SESSION.createdAt,
    };
    const session = { ...SESSION, goal: '[HL-204] Stop retried webhooks posting a second credit' };
    useAppStore.setState({
      sessions: [session],
      sessionExternalTasks: { [SESSION_ID]: [linked] },
    });
    renderPane({ session });

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('HL-204Stop retried webhooks posting a second credit');
    expect(screen.getByText('HL-204').className).toContain('font-mono');
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull();
  });

  it('renames the session in place on double click, writing only after the save lands', async () => {
    const { rerender } = renderPane();
    fireEvent.doubleClick(screen.getByTestId('overview-title'));
    const field = screen.getByRole('textbox', { name: 'Session title' });
    fireEvent.change(field, { target: { value: 'Key redeliveries by event id' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull(),
    );
    expect(renameSession).toHaveBeenCalledWith(
      expect.anything(),
      SESSION_ID,
      'Key redeliveries by event id',
      expect.any(String),
      true,
    );
    const renamed = useAppStore.getState().sessions.find((row) => row.id === SESSION_ID);
    expect(renamed?.goal).toBe('Key redeliveries by event id');
    rerender(<SessionOverviewPane session={renamed ?? SESSION} onSelectLens={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Key redeliveries by event id',
    );
  });

  it('keeps the old title and shows the error when the rename fails', async () => {
    let fail: (error: Error) => void = () => undefined;
    renameSession.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    renderPane();
    fireEvent.doubleClick(screen.getByTestId('overview-title'));
    const field = screen.getByRole('textbox', { name: 'Session title' });
    fireEvent.change(field, { target: { value: 'Key redeliveries by event id' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(useAppStore.getState().sessions[0]?.goal).toBe(SESSION.goal);
    fail(new Error('database is locked'));

    expect((await screen.findByRole('alert')).textContent).toContain('database is locked');
    expect(useAppStore.getState().sessions[0]?.goal).toBe(SESSION.goal);
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('cancels the rename on Escape without writing', () => {
    renderPane();
    fireEvent.doubleClick(screen.getByTestId('overview-title'));
    const field = screen.getByRole('textbox', { name: 'Session title' });
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(renameSession).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(SESSION.goal);
    expect(useAppStore.getState().sessions[0]?.goal).toBe(SESSION.goal);
  });

  it('keeps the title read only on an archived session', () => {
    renderPane({ session: { ...SESSION, archivedAt: SESSION.createdAt } });
    fireEvent.doubleClick(screen.getByTestId('overview-title'));

    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
  });

  it('keeps New on a live session and only Restore once archived', () => {
    const { unmount } = renderPane();
    screen.getByRole('button', { name: /New/ });
    unmount();

    renderPane({ session: { ...SESSION, archivedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime } });
    expect(screen.queryByRole('button', { name: /New/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(screen.queryByText('Archived')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Notices' })).toBeNull();
  });
});
