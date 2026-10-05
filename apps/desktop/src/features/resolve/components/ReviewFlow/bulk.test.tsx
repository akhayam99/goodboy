// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION, seedResolveScene } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  BULK_LAUNCH_THREAD_IDS,
  seedBulkScene,
  type BulkStage,
} from '../../../../app/components/MockScene/scenes/bulkSeed';
import { ResolveBulkScene } from '../../../../app/components/MockScene/scenes/ResolveBulkScene';
import { BranchPage } from '../../../branch/components/BranchPage';
import { eligibleReviewThreads } from '../../../suggestions/eligibleThreads';
import { requestReview } from '../../../review/reviewRequest';
import { isFixableThread } from '../../fixableComments';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  restore = {
    ...Object.fromEntries(Object.keys(actions).map((key) => [key, state[key as keyof StoreState]])),
    ...restore,
  };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ stage }: { readonly stage: BulkStage }): Promise<void> => {
  seedBulkScene({ stage });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });
const press = (key: string, code: string, init: KeyboardEventInit = {}): void => {
  fireEvent.keyDown(document.activeElement ?? list(), { key, code, ...init });
};
const focusRow = (name: RegExp): void =>
  within(list())
    .getAllByRole('button')
    .find((candidate) => name.test(candidate.textContent ?? ''))
    ?.focus();

const stubAgents = () => {
  const spawnAgent = vi.fn<StoreState['spawnAgent']>();
  const createResolveBatch = vi.fn<StoreState['createResolveBatch']>();
  stub({ spawnAgent, createResolveBatch });
  return { spawnAgent, createResolveBatch };
};

describe('the fixable set', () => {
  it('is the same from the list, the Overview and the board: open plus could not fix, never needs you', async () => {
    await mount({ stage: 'launch' });
    const state = useAppStore.getState();
    const threads = (state.sessionResolveQueueItems[SESSION.id] ?? []).map((entry) => entry.thread);

    const fromList = new Set(
      threads.filter((thread) => isFixableThread({ thread })).map((thread) => thread.threadId),
    );
    const fromDoors = new Set(
      eligibleReviewThreads({ github: state.sessionGithub[SESSION.id] ?? null, rows: threads }).map(
        (thread) => thread.head.threadId,
      ),
    );
    expect(fromList.size).toBe(9);
    expect(fromDoors).toEqual(fromList);
    expect([...fromList].sort()).toEqual([...BULK_LAUNCH_THREAD_IDS].sort());

    focusRow(/retryPolicy\.ts/);
    press('a', 'KeyA', { ctrlKey: true });
    expect(new Set(useAppStore.getState().reviewSelection[SESSION.id])).toEqual(fromList);
  });
});

describe('Fix open comments', () => {
  it('shows one line with the count and opens the launch panel with the whole set, starting nothing', async () => {
    const { spawnAgent, createResolveBatch } = stubAgents();
    await mount({ stage: 'launch' });

    fireEvent.click(screen.getByRole('button', { name: /^Fix 9 open comments/ }));

    const panel = await screen.findByRole('region', { name: 'Fix launch' });
    expect(within(panel).getByText('Fix 9 comments')).toBeDefined();
    expect(within(panel).getAllByRole('checkbox')).toHaveLength(9);
    expect(within(panel).queryByText(/What should the client see/)).toBeNull();
    expect(useAppStore.getState().reviewSelection[SESSION.id]).toHaveLength(9);
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(createResolveBatch).not.toHaveBeenCalled();
  });

  it('is replaced by the run actions once a run exists', async () => {
    await mount({ stage: 'answers' });

    expect(screen.queryByRole('button', { name: /^Fix \d+ open comments?/ })).toBeNull();
  });

  it('opens the same pre-filled panel when the Overview or the board asks, never a silent launch', async () => {
    const { spawnAgent, createResolveBatch } = stubAgents();
    await mount({ stage: 'launch' });

    act(() => {
      requestReview({
        getState: useAppStore.getState,
        sessionId: SESSION.id,
        request: { kind: 'fix', threadIds: [...BULK_LAUNCH_THREAD_IDS] },
      });
    });

    const panel = await screen.findByRole('region', { name: 'Fix launch' });
    expect(within(panel).getByText('Fix 9 comments')).toBeDefined();
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(createResolveBatch).not.toHaveBeenCalled();
  });
});

describe('answers in bulk', () => {
  const answersButton = (): HTMLElement =>
    screen.getByRole('button', { name: 'Use the recommended answers (2)' });

  it('offers the recommended answers in the run status line when two or more questions are open', async () => {
    await mount({ stage: 'answers' });

    const status = screen.getByRole('region', { name: 'Fix run' });
    expect(within(status).getByRole('button', { name: 'Use the recommended answers (2)' })).toBe(
      answersButton(),
    );
    expect(screen.getAllByRole('group', { name: 'Fix run actions' })).toHaveLength(1);
  });

  it('shows each question with its recommended option preselected and continues the run once with all of them', async () => {
    const { spawnAgent } = stubAgents();
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ stage: 'answers' });

    fireEvent.click(answersButton());

    const panel = await screen.findByRole('region', {
      name: 'Answer the questions of the fix run',
    });
    expect(within(panel).getByText('Answer 2 questions')).toBeDefined();
    const checked = within(panel)
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(checked.map((radio) => radio.textContent)).toEqual([
      'Return 409 with the retry hintRecommended',
      'Keep the one in retryPolicy.tsRecommended',
    ]);
    expect(within(panel).getAllByRole('radio')).toHaveLength(4);

    fireEvent.click(within(panel).getByRole('radio', { name: /Return 200 and drop silently/ }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Continue with 2 answers' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      launchId: 'mock-bulk-launch',
      answers: [
        { threadId: 'PRRT_bulk_c1', answer: 'Return 200 and drop silently' },
        { threadId: 'PRRT_bulk_q2', answer: 'Keep the one in retryPolicy.ts' },
      ],
    });
    expect(spawnAgent).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Answer the questions of the fix run' }),
      ).toBeNull(),
    );
  });

  it('drops a question out of the batch and leaves it in Needs you', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ stage: 'answers' });

    fireEvent.click(answersButton());
    const panel = await screen.findByRole('region', {
      name: 'Answer the questions of the fix run',
    });
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Drop' })[0] as HTMLElement);
    expect(within(panel).getByText(/Dropped from this batch/)).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: 'Continue with 1 answer' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions.mock.calls[0]?.[0].answers).toEqual([
      { threadId: 'PRRT_bulk_q2', answer: 'Keep the one in retryPolicy.ts' },
    ]);
  });

  it('closes with Escape and changes nothing', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ stage: 'answers' });

    fireEvent.click(answersButton());
    await screen.findByRole('region', { name: 'Answer the questions of the fix run' });
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    expect(
      screen.queryByRole('region', { name: 'Answer the questions of the fix run' }),
    ).toBeNull();
    expect(answerQuestions).not.toHaveBeenCalled();
  });

  it('does not offer a bulk answer for a single open question', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedBulkScene({ stage: 'answers' });
    useAppStore.setState({
      sessionOpenQuestions: {
        [SESSION.id]: (useAppStore.getState().sessionOpenQuestions[SESSION.id] ?? []).slice(0, 1),
      },
    });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={null} />
      </ToastProvider>,
    );
    await settle();

    expect(screen.queryByRole('button', { name: /^Use the recommended answers/ })).toBeNull();
  });
});

describe('accept in bulk', () => {
  const acceptStub = () => {
    const acceptReviewComments = vi.fn<StoreState['acceptReviewComments']>(
      async ({ threadIds }) => ({
        acceptedCount: threadIds.length,
        failures: [],
      }),
    );
    stub({ acceptReviewComments });
    return acceptReviewComments;
  };

  it('puts Accept N on the Ready header of the five-word list and accepts exactly those', async () => {
    const acceptReviewComments = acceptStub();
    await mount({ stage: 'retry' });
    useAppStore.getState().clearReviewSelection({ sessionId: SESSION.id });

    const ready = within(list()).getByRole('region', { name: 'Ready' });
    const header = await within(ready).findByRole('button', { name: 'Accept 7' });
    expect(within(list()).getAllByRole('button', { name: /^Accept \d+$/ })).toHaveLength(1);
    fireEvent.click(header);

    await waitFor(() => expect(acceptReviewComments).toHaveBeenCalledOnce());
    expect(acceptReviewComments.mock.calls[0]?.[0].threadIds).toHaveLength(7);
    expect(acceptReviewComments.mock.calls[0]?.[0].threadIds).not.toContain('PRRT_bulk_f1');
  });

  it('says Accept 3 in the selection bar when three ready rows are selected, with Fix left out', async () => {
    const acceptReviewComments = acceptStub();
    await mount({ stage: 'review' });

    const bar = screen.getByRole('toolbar', { name: 'Selected comments' });
    expect(within(bar).getByText('3 selected')).toBeDefined();
    expect(within(bar).queryByRole('button', { name: /^Fix \d/ })).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: 'Accept 3' }));

    await waitFor(() => expect(acceptReviewComments).toHaveBeenCalledOnce());
    expect(acceptReviewComments.mock.calls[0]?.[0].threadIds).toEqual([
      'PRRT_bulk_r1',
      'PRRT_bulk_r2',
      'PRRT_bulk_r3',
    ]);
  });

  it('shows the undo bar for the last bulk accept and undoes it from the bar', async () => {
    const undoReviewAccepts = vi.fn<StoreState['undoReviewAccepts']>(async () => true);
    stub({ undoReviewAccepts });
    await mount({ stage: 'accepted' });

    expect(screen.getByText('5 accepted')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Undo/ }));

    await waitFor(() => expect(undoReviewAccepts).toHaveBeenCalledWith({ sessionId: SESSION.id }));
  });

  it('shows no undo bar once the accepted comments are no longer undoable', async () => {
    await mount({ stage: 'review' });
    useAppStore.getState().clearReviewSelection({ sessionId: SESSION.id });
    act(() => {
      useAppStore.setState({
        reviewBulkAccepts: {
          [SESSION.id]: { operationId: 'stale', itemIds: ['mock-bulk-item-r1'] },
        },
      });
    });

    expect(screen.queryByText(/ accepted$/)).toBeNull();
  });

  it('names what it could not accept instead of failing silently', async () => {
    const acceptReviewComments = vi.fn<StoreState['acceptReviewComments']>(async () => ({
      acceptedCount: 4,
      failures: [
        { threadId: 'PRRT_bulk_r5', message: 'This fix collides with one accepted before it' },
      ],
    }));
    stub({ acceptReviewComments });
    await mount({ stage: 'retry' });
    useAppStore.getState().clearReviewSelection({ sessionId: SESSION.id });

    fireEvent.click(await screen.findByRole('button', { name: 'Accept 7' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('1 comment not accepted');
    expect(alert.textContent).toContain('collides with one accepted before it');
  });
});

describe('bulk scenes', () => {
  it('shows the launch panel on the fixable set and the answers panel on the open questions', async () => {
    render(
      <ToastProvider>
        <ResolveBulkScene stage="launch" />
      </ToastProvider>,
    );
    const launch = await screen.findByRole('region', { name: 'Fix launch' });
    expect(within(launch).getByText('Fix 9 comments')).toBeDefined();
    cleanup();

    render(
      <ToastProvider>
        <ResolveBulkScene stage="answers" />
      </ToastProvider>,
    );
    const answers = await screen.findByRole('region', {
      name: 'Answer the questions of the fix run',
    });
    expect(within(answers).getByText('Answer 2 questions')).toBeDefined();
  });
});

describe('retry in bulk', () => {
  it('retries every comment that could not be fixed in the same run and starts no agent', async () => {
    const { spawnAgent } = stubAgents();
    const retryCouldntFix = vi.fn<StoreState['retryCouldntFix']>(async () => undefined);
    stub({ retryCouldntFix });
    await mount({ stage: 'retry' });

    const status = screen.getByRole('region', { name: 'Fix run' });
    fireEvent.click(within(status).getByRole('button', { name: "Retry 1 that couldn't fix" }));

    await waitFor(() => expect(retryCouldntFix).toHaveBeenCalledOnce());
    expect(retryCouldntFix).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      launchId: 'mock-bulk-launch',
      threadIds: ['PRRT_bulk_f1'],
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('is absent when nothing could not be fixed', async () => {
    await mount({ stage: 'answers' });

    expect(screen.queryByRole('button', { name: /^Retry \d+ that couldn't fix/ })).toBeNull();
  });
});
