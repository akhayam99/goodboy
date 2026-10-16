// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('./HeaderBand', () => ({ HeaderBand: () => <p>Overview goal</p> }));
vi.mock('./ContextChip', () => ({ ContextChip: () => null }));
vi.mock('./ArchivedRestore', () => ({ ArchivedRestore: () => null }));
vi.mock('./OverviewPageActions', () => ({ OverviewPageActions: () => null }));
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
import { cleanup, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
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

  it('keeps New on a live session and disables it once archived', () => {
    const { unmount } = renderPane();
    screen.getByRole('button', { name: /New/ });
    unmount();

    renderPane({ session: { ...SESSION, archivedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime } });
    expect(screen.getByRole('button', { name: /New/ }).closest('fieldset')?.disabled).toBe(true);
  });
});
