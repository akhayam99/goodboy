// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { HINT_NODE_SEED } from '../surfaces/hint-node/hintNodeSeed';
import { U34_HINT_QUEUE_SCENES } from './hint-queue';

type QueueReport = {
  readonly isIntersecting: boolean;
};

let reportQueue: (report: QueueReport) => void = () => undefined;

class QueueObserver {
  constructor(callback: (entries: ReadonlyArray<QueueReport>) => void) {
    reportQueue = (report) => callback([report]);
  }
  observe(): void {}
  disconnect(): void {}
}

const WAIT = { timeout: 15_000 };
const HEADING_TEN = 'Queued, read at the next decision';

const Scene = U34_HINT_QUEUE_SCENES['u34-p24-ten-hints'];
const ReadingScene = U34_HINT_QUEUE_SCENES['u34-p24-ten-hints-reading'];

const scrollIntoView = vi.fn();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'attachment_read') {
      const relPath = HINT_NODE_SEED.imageRelPathOf({ payload: args });
      return Promise.resolve(relPath === null ? null : HINT_NODE_SEED.imageDataUriOf({ relPath }));
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const pageOf = (): HTMLElement => {
  const page = document.querySelector<HTMLElement>('[data-hint-queue-page]');
  if (page === null) {
    throw new Error('The page is missing.');
  }
  return page;
};

const composerOf = (): HTMLElement => {
  const composer = document.querySelector<HTMLElement>('[data-orchestrated-composer]');
  if (composer === null) {
    throw new Error('The composer is missing.');
  }
  return composer;
};

const queueOf = () => within(screen.getByRole('list', { name: 'Queued hints' }));

describe('the queued hints on the run line', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', QueueObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the dock line only while the queue is out of view', async () => {
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    expect(document.querySelector('[data-hint-queue-line]')).toBeNull();

    act(() => reportQueue({ isIntersecting: false }));
    const input = screen.getByPlaceholderText('Hint the orchestrator');
    const line = document.querySelector<HTMLElement>('[data-hint-queue-line]');
    expect(line?.getAttribute('data-hint-queue-line')).toBe('over-the-input');
    expect(line?.contains(input)).toBe(false);

    act(() => reportQueue({ isIntersecting: true }));
    expect(document.querySelector('[data-hint-queue-line]')).toBeNull();
  });

  it('registers both scenes', () => {
    expect(MOCK_SCENES['u34-p24-ten-hints']).toBe(Scene);
    expect(MOCK_SCENES['u34-p24-ten-hints-reading']).toBe(ReadingScene);
  });

  it('keeps ten hints in the page and only the input and one line under it', async () => {
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    const list = screen.getByRole('list', { name: 'Queued hints' });
    expect(pageOf().contains(list)).toBe(true);
    expect(composerOf().contains(list)).toBe(false);
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(within(composerOf()).queryAllByRole('list')).toHaveLength(0);
    screen.getByPlaceholderText('Hint the orchestrator');
  });

  it('keeps the order the hints were sent in', async () => {
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    const texts = Array.from(
      document.querySelectorAll('[data-hint-chip="queued"] [data-hint-text]'),
    ).map((node) => node.textContent);
    expect(texts[0]).toBe('Also cover the refund webhook.');
    expect(texts[9]).toBe('Write the release note last.');
  });

  it('scrolls to the queue from View and moves nothing when a hint is sent', async () => {
    const addWorkflowOrchestratorHint = vi.fn(async () => null);
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    act(() => useAppStore.setState({ addWorkflowOrchestratorHint }));
    scrollIntoView.mockClear();
    const field = screen.getByPlaceholderText('Hint the orchestrator');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Keep the header row' } });
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));
    await act(async () => undefined);
    expect(addWorkflowOrchestratorHint).toHaveBeenCalledWith(
      HINT_NODE_SEED.sessionId,
      HINT_NODE_SEED.runId,
      expect.objectContaining({ text: 'Keep the header row' }),
    );
    expect(
      scrollIntoView.mock.contexts.filter(
        (node: unknown) => node instanceof Node && pageOf().contains(node),
      ),
    ).toHaveLength(0);

    act(() => reportQueue({ isIntersecting: false }));
    within(composerOf()).getByText(/hints queued/);
    fireEvent.click(within(composerOf()).getByRole('button', { name: 'View' }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      document.querySelector(`[data-hint-queue="${HINT_NODE_SEED.runId}"]`),
    );
  });

  it('keeps Send now in the input and Remove on the row', async () => {
    const removeWorkflowOrchestratorHint = vi.fn(async () => undefined);
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    act(() => useAppStore.setState({ removeWorkflowOrchestratorHint }));
    const field = screen.getByPlaceholderText('Hint the orchestrator');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Do it now' } });
    expect(screen.getByTestId('orchestrator-hint-now').textContent).toContain('Send now');

    const third = queueOf().getAllByRole('button', { name: 'Remove' }).at(2);
    if (third === undefined) {
      throw new Error('The third Remove button is missing.');
    }
    fireEvent.click(third);

    expect(removeWorkflowOrchestratorHint).toHaveBeenCalledWith(
      HINT_NODE_SEED.sessionId,
      HINT_NODE_SEED.runId,
      'mock-u34-hq-hint-2',
    );
  });

  it('shows the reading hint with a disabled Remove and keeps the count', async () => {
    render(<ReadingScene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    const reading = document.querySelector<HTMLElement>('[data-hint-chip="reading"]');
    if (reading === null) {
      throw new Error('The reading hint row is missing.');
    }
    const row = within(reading);
    row.getByText('Reading now');
    expect(row.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true);
  });

  it('follows a second window that removed a hint', async () => {
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    const run = HINT_NODE_SEED.session.workflowRuns[0];
    const current = useAppStore.getState().sessions[0];
    if (run === undefined || current === undefined) {
      throw new Error('The seeded run is missing.');
    }
    const currentRun = current.workflowRuns[0];
    act(() =>
      useAppStore.setState({
        sessions: [
          {
            ...current,
            workflowRuns: [
              {
                ...run,
                orchestratorHints: (currentRun?.orchestratorHints ?? []).filter(
                  (hint) => hint.id !== 'mock-u34-hq-hint-4',
                ),
              },
            ],
          },
        ],
      }),
    );
    await screen.findByText('Queued, read at the next decision');
    expect(queueOf().queryByText('Add a test for the 502 from payments-api.')).toBeNull();
  });

  it('opens the same viewer from a 24px thumbnail on the row', async () => {
    render(<Scene />);
    await screen.findByText(HEADING_TEN, undefined, WAIT);
    const thumb = (
      await screen.findAllByRole('button', { name: 'Preview relay-log.png' }, WAIT)
    )[0];
    if (thumb === undefined) {
      throw new Error('The thumbnail is missing.');
    }
    fireEvent.click(thumb);
    await screen.findByRole('dialog', { hidden: true }, WAIT);
  });
});
