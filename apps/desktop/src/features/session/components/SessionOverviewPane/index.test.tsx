// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('./HeaderBand', () => ({ HeaderBand: () => <h1>Overview title</h1> }));
vi.mock('./ProjectMountRows', () => ({
  ProjectMountRows: () => <section aria-label="Projects" />,
}));
vi.mock('./OverviewActions', () => ({ OverviewActions: () => <button type="button">New</button> }));
vi.mock('../../../suggestions/components/NextStepSlot', () => ({
  NextStepSlot: () => <section aria-label="Next step" />,
}));
vi.mock('../SessionWorkspace/parts/TimelinePane', () => ({
  TimelinePane: ({ actions }: { readonly actions: ReactNode }) => (
    <section aria-label="Activity">{actions}</section>
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
  it('stacks Projects and Activity as body sections on the one pane rhythm', () => {
    const { container } = renderPane();

    const body = container.querySelector('[data-slot="pane-body"]');
    const header = container.querySelector('[data-slot="pane-header"]');
    expect(screen.getByRole('region', { name: 'Projects' }).parentElement).toBe(body);
    expect(screen.getByRole('region', { name: 'Next step' }).parentElement).toBe(body);
    expect(screen.getByRole('region', { name: 'Activity' }).parentElement).toBe(body);
    expect(header?.getAttribute('data-rhythm')).toBe('section');
  });

  it('says what waits on the user in the next step, never as a callout above it', () => {
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

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
  });

  it('keeps New on a live session and disables it once archived', () => {
    const { unmount } = renderPane();
    screen.getByRole('button', { name: /New/ });
    unmount();

    renderPane({ session: { ...SESSION, archivedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime } });
    expect(screen.getByRole('button', { name: /New/ }).closest('fieldset')?.disabled).toBe(true);
  });
});
