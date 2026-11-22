// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { SessionAttentionReason, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { attentionPlace } from '../../../session/attentionPlace';
import {
  harborline,
  ledgerCore,
  openQuestionFor,
  seedColumn,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import type { QueueMove } from '../needsYouOf';
import { QueueBoard } from '.';
import { queueLandingOf } from '../queueLandingOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ live_work: [] });
});

afterEach(cleanup);

const quiet = sessionOf({ goal: 'Backfill ledger balances' });
const asking = sessionOf({ goal: 'Fix webhook retries' });

const renderQueue = () =>
  render(
    <ToastProvider>
      <QueueBoard workspaceId={harborline.id} sessions={useAppStore.getState().sessions} />
    </ToastProvider>,
  );

type MoveParams = {
  readonly reason: SessionAttentionReason;
};

const moveOf = ({ reason }: MoveParams): QueueMove => ({
  id: `${asking.id}:${reason}`,
  sessionId: asking.id,
  reason,
  kind: 'page',
  title: reason,
  question: null,
  since: null,
});

describe('the Queue', () => {
  it('says nothing waits, nothing runs and nothing is ready, without a count', () => {
    seedColumn({ store: useAppStore, sessions: [quiet], mounts: [[quiet, ledgerCore]] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    within(needsYou).getByText('Nothing waits on you.');
    expect(within(needsYou).queryByText('0')).toBeNull();
    const ready = screen.getByRole('region', { name: 'Ready to merge' });
    within(ready).getByText('Nothing to merge');
    expect(within(ready).queryByText('0')).toBeNull();
    within(screen.getByRole('region', { name: 'Running' })).getByText('Nothing is running');
  });

  it('puts the question that waits on you in Needs you, as the focused Move', () => {
    seedColumn({ store: useAppStore, sessions: [quiet, asking], questions: [asking] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const question = openQuestionFor({ sessionId: asking.id });
    within(needsYou).getByText(question.text);
    expect(needsYou.querySelector('[data-queue-move-focus]')).not.toBeNull();
    expect(within(needsYou).queryByText('Nothing waits on you.')).toBeNull();
  });

  it.each(['open-question', 'needs-approval', 'plan-approval'] as const)(
    'opens the overview with the Move on top for %s, never the desk',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      expect(queueLandingOf({ state: useAppStore.getState(), move: moveOf({ reason }) })).toEqual(
        sessionPlace({ sessionId: asking.id }),
      );
    },
  );

  it.each(['ci-failed', 'changes-requested', 'fix-needs-you'] as const)(
    'opens %s where the Move acts',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      const state = useAppStore.getState();
      expect(queueLandingOf({ state, move: moveOf({ reason }) })).toEqual(
        attentionPlace({ state, sessionId: asking.id, reason }),
      );
    },
  );
});
