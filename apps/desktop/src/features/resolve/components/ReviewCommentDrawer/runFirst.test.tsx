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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type Agent, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  BROAD_THREAD_ID,
  seedBroadComment,
} from '../../../../app/components/MockScene/scenes/u47/seedBroadComment';
import { DrawerHost } from '../../../../app/components/DrawerHost';
import { BranchPage } from '../../../branch/components/BranchPage';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  stubStoryInvoke({ worktree_diff_range: '' });
});

afterEach(() => {
  cleanup();
});

type RunParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
  readonly status?: Agent['status'];
};

const runOf = ({ id, ordinal, threadIds, status = 'running' }: RunParams): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION.id,
    ordinal,
    status,
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: threadIds,
  });

type MountParams = {
  readonly runs?: ReadonlyArray<Agent>;
};

const mount = async ({ runs = [] }: MountParams): Promise<HTMLElement> => {
  seedResolveScene({ expandedThreadId: BROAD_THREAD_ID });
  seedBroadComment();
  useAppStore.setState({ sessionPhaseRuns: { [SESSION.id]: runs } });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  return screen.findByRole('toolbar', { name: 'Comment actions' });
};

type VerbParams = {
  readonly bar: HTMLElement;
  readonly id: string;
};

const verbOf = ({ bar, id }: VerbParams) =>
  bar.querySelector<HTMLButtonElement>(`[data-review-verb="${id}"]`);

describe('a broad comment leads with Start a run, the fix one click away', () => {
  it('opens the start form in place from the primary', async () => {
    const bar = await mount({});
    const start = verbOf({ bar, id: 'reviewComment.startRun' });
    expect(start?.textContent).toContain(COMMENT_RUN_COPY.startRun);
    expect(verbOf({ bar, id: 'reviewComment.draft' })).toBeNull();
    screen.getByText(COMMENT_RUN_COPY.suggestTitle);

    fireEvent.click(start ?? document.body);

    await screen.findByRole('region', { name: COMMENT_RUN_COPY.label });
    expect(useAppStore.getState().commentRunStarts[SESSION.id]?.openThreadId).toBe(BROAD_THREAD_ID);
    expect(document.querySelector('[data-comment-run-suggest]')).toBeNull();
  });

  it('keeps Fix as one change in the more menu', async () => {
    await mount({});
    const drawer = document.querySelector<HTMLElement>(`[data-review-drawer="${BROAD_THREAD_ID}"]`);
    expect(drawer).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0] ?? document.body);
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent ?? '')).toEqual(
      expect.arrayContaining([expect.stringContaining(COMMENT_RUN_COPY.fixAsOne)]),
    );
  });
});

describe('a comment already in a run', () => {
  it('leads with Open run, offers no fix and no second run, and opens its own run', async () => {
    const navigate = vi.fn<ReturnType<StoryStore['getState']>['navigate']>();
    const own = runOf({ id: 'run-retry-loop', ordinal: 2, threadIds: [BROAD_THREAD_ID] });
    const other = runOf({ id: 'run-idempotency', ordinal: 3, threadIds: [THREAD_IDS.idempotency] });
    const bar = await mount({ runs: [own, other] });
    act(() => {
      useAppStore.setState({ navigate });
    });

    await waitFor(() =>
      expect(verbOf({ bar, id: 'reviewComment.openRun' })?.textContent).toContain(
        COMMENT_RUN_COPY.openRun,
      ),
    );
    expect(verbOf({ bar, id: 'reviewComment.startRun' })).toBeNull();
    expect(verbOf({ bar, id: 'reviewComment.draft' })).toBeNull();
    expect(document.querySelector('[data-comment-run-suggest]')).toBeNull();

    fireEvent.click(verbOf({ bar, id: 'reviewComment.openRun' }) ?? document.body);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.objectContaining({ agentId: own.id }) }),
    );
  });

  it('frees the comment again once its run is stopped', async () => {
    const stopped = runOf({
      id: 'run-retry-loop',
      ordinal: 2,
      threadIds: [BROAD_THREAD_ID],
      status: 'stopped',
    });
    const bar = await mount({ runs: [stopped] });

    expect(verbOf({ bar, id: 'reviewComment.openRun' })).toBeNull();
    expect(within(bar).getByText(COMMENT_RUN_COPY.startRun)).toBeTruthy();
  });
});
