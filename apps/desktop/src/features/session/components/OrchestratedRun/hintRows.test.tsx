// @vitest-environment happy-dom

const { listGoalAttachmentsForRun } = vi.hoisted(() => ({ listGoalAttachmentsForRun: vi.fn() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({ listGoalAttachmentsForRun }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { HintRowsBody } from './testing/HintRowsBody';
import { hintRowsFixture } from './testing/hintRowsFixture';

const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');
const LONG = 'Cover refunds.\nThen check the webhook timeout.';
const SHORT = 'Cover refunds.';

type HintParams = {
  readonly id: string;
  readonly text?: string;
  readonly step?: number;
  readonly isRead?: boolean;
  readonly isWithImages?: boolean;
};

const hintOf = ({
  id,
  text = LONG,
  step,
  isRead = step !== undefined,
  isWithImages = false,
}: HintParams): OrchestratorHint => ({
  id,
  text,
  createdAt: AT,
  ...(isRead ? { consumedAt: AT } : {}),
  ...(step === undefined ? {} : { consumedAtStep: step }),
  ...(isWithImages ? { attachmentIds: hintRowsFixture.imageIds } : {}),
});

let useAppStore: StoryStore;
let resize: FakeResizeObservers;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listGoalAttachmentsForRun.mockReset();
  stubStoryInvoke({ attachment_read: 'data:image/png;base64,AAAA' });
  resize = installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type MountParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly agentCount?: number;
  readonly isLoaded?: boolean;
};

const mount = ({ hints, agentCount = 2, isLoaded = false }: MountParams) => {
  const seeded = hintRowsFixture.seed({ hints, agentCount, isLoaded });
  const view = render(<HintRowsBody {...seeded} />);
  return { ...view, seeded };
};

type MoveParams = {
  readonly view: ReturnType<typeof mount>;
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

const moveTo = ({ view, hints }: MoveParams) => {
  const run = hintRowsFixture.runWith({ hints });
  useAppStore.setState({
    sessions: [{ ...view.seeded.session, workflowRuns: [run] }],
  });
  view.rerender(
    <HintRowsBody session={view.seeded.session} run={run} workflow={view.seeded.workflow} />,
  );
};

const readRow = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-hint-chip="read"]');
  if (row === null) {
    throw new Error('The read hint row is missing.');
  }
  return row;
};

describe('a hint that moves between the composer and the checklist', () => {
  it('stays expanded and keeps focus on its control when the orchestrator reads it', async () => {
    const queued = hintOf({ id: 'h1' });
    const view = mount({ hints: [queued] });
    const toggle = await screen.findByRole('button', { name: /^Show more of hint: / });
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('list', { name: 'Queued hints' })).not.toBeNull();

    moveTo({ view, hints: [{ ...queued, consumedAt: AT, consumedAtStep: 2 }] });

    expect(screen.queryByRole('list', { name: 'Queued hints' })).toBeNull();
    const moved = within(readRow()).getByRole('button', { name: /^Show less of hint: / });
    expect(moved).not.toBe(toggle);
    expect(moved.getAttribute('aria-expanded')).toBe('true');
    within(readRow()).getByText(/Then check the webhook timeout/);
    expect(document.activeElement).toBe(moved);
  });

  it('keeps the image viewer open on the same image when the row moves', async () => {
    const queued = hintOf({ id: 'h1', isWithImages: true });
    const view = mount({ hints: [queued], isLoaded: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview relay-log.png' }));
    const open = await screen.findByRole('dialog', { hidden: true });
    expect(within(open).getByRole('heading', { level: 2, hidden: true }).textContent).toBe(
      'relay-log.png',
    );

    moveTo({ view, hints: [{ ...queued, consumedAt: AT, consumedAtStep: 2 }] });

    const reopened = await screen.findByRole('dialog', { hidden: true });
    expect(within(reopened).getByRole('heading', { level: 2, hidden: true }).textContent).toBe(
      'relay-log.png',
    );
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1);
  });

  it('keeps each hint of the run on its own state', async () => {
    const first = hintOf({ id: 'h1', text: 'First hint\nwith a second line' });
    const second = hintOf({ id: 'h2', text: 'Second hint\nwith a second line' });
    const view = mount({ hints: [first, second] });
    fireEvent.click(await screen.findByRole('button', { name: 'Show more of hint: First hint' }));

    moveTo({ view, hints: [{ ...first, consumedAt: AT, consumedAtStep: 2 }, second] });

    within(readRow()).getByRole('button', { name: 'Show less of hint: First hint' });
    screen.getByRole('button', { name: 'Show more of hint: Second hint' });
  });
});

describe('the text of a hint that does not fit', () => {
  it('offers Show more for a short hint only while the pane cuts it, and takes it back when it fits', async () => {
    let clientWidth = 300;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => clientWidth);
    mount({ hints: [hintOf({ id: 'h1', text: SHORT })] });
    await screen.findByText(SHORT);
    expect(screen.queryByRole('button', { name: /^Show more/ })).toBeNull();

    clientWidth = 120;
    act(() => resize.resizeAll());
    const toggle = await screen.findByRole('button', { name: 'Show more of hint: Cover refunds.' });
    fireEvent.click(toggle);
    screen.getByRole('button', { name: 'Show less of hint: Cover refunds.' });

    fireEvent.click(screen.getByRole('button', { name: /^Show less/ }));
    clientWidth = 300;
    act(() => resize.resizeAll());
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Show more/ })).toBeNull());
  });

  it('keeps Show less reachable after the row remounts while expanded', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
    const queued = hintOf({ id: 'h1', text: SHORT });
    const view = mount({ hints: [queued] });
    fireEvent.click(await screen.findByRole('button', { name: /^Show more/ }));

    moveTo({ view, hints: [{ ...queued, consumedAt: AT, consumedAtStep: 2 }] });

    within(readRow()).getByRole('button', { name: /^Show less of hint: / });
  });

  it('still expands a hint with a second line however wide the pane is', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    mount({ hints: [hintOf({ id: 'h1' })] });

    await screen.findByRole('button', { name: /^Show more of hint: / });
  });
});

describe('what assistive tech reads for a hint', () => {
  it('says Queued hint and Hint in the text, since the node is decorative', async () => {
    mount({
      hints: [hintOf({ id: 'h1', text: SHORT }), hintOf({ id: 'h2', text: SHORT, step: 2 })],
    });

    await screen.findAllByText('Queued hint');
    expect(screen.getAllByText('Queued hint')).toHaveLength(1);
    within(readRow()).getByText('Hint');
  });

  it('names each toggle after its hint and always renders the body it controls', async () => {
    mount({
      hints: [
        hintOf({ id: 'h1', text: 'First hint\nmore' }),
        hintOf({ id: 'h2', text: 'Second hint\nmore' }),
      ],
    });
    const first = await screen.findByRole('button', { name: 'Show more of hint: First hint' });
    const second = screen.getByRole('button', { name: 'Show more of hint: Second hint' });

    const body = document.getElementById(first.getAttribute('aria-controls') ?? '');
    expect(body).not.toBeNull();
    expect(body?.closest('[hidden]')).not.toBeNull();
    expect(second.getAttribute('aria-controls')).not.toBe(first.getAttribute('aria-controls'));
    fireEvent.click(first);
    expect(body?.closest('[hidden]')).toBeNull();
    expect(body?.textContent).toContain('more');
  });
});

describe('the step a hint was read at', () => {
  it('is plain text while the step has no row, and a link once the step exists', async () => {
    const view = mount({ hints: [hintOf({ id: 'h1', step: 3 })], agentCount: 2 });
    await screen.findByText('Read at step 3');
    expect(screen.queryByRole('button', { name: 'Read at step 3' })).toBeNull();

    act(() =>
      useAppStore.setState({
        sessionPhaseRuns: {
          [view.seeded.session.id]: hintRowsFixture.agentsOf({ count: 3 }).map((agent) => ({
            ...agent,
            workflowRunId: view.seeded.run.id,
          })),
        },
      }),
    );

    await screen.findByRole('button', { name: 'Read at step 3' });
  });

  it('puts two hints read by one step before that step, each with a link to its row', async () => {
    const view = mount({
      hints: [hintOf({ id: 'h1', step: 2 }), hintOf({ id: 'h2', text: 'Second hint', step: 2 })],
    });
    const links = await screen.findAllByRole('button', { name: 'Read at step 2' });
    expect(links).toHaveLength(2);
    const stepRow = screen.getByTestId(`run-tree-row-${view.seeded.agents[1]?.id}`);

    const second = links.at(1);
    if (second === undefined) {
      throw new Error('The second step link is missing.');
    }
    fireEvent.click(second);

    expect(stepRow.contains(document.activeElement)).toBe(true);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('opens the step in the drawer when its row is not on screen', async () => {
    const view = mount({ hints: [hintOf({ id: 'h1', step: 2 })] });
    const link = await screen.findByRole('button', { name: 'Read at step 2' });
    const query = Element.prototype.querySelector;
    vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector.includes('run-tree-row-') ? null : query.call(this, selector);
    });

    fireEvent.click(link);

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'run-step',
      payload: { runId: view.seeded.run.id, agentId: view.seeded.agents[1]?.id },
    });
  });

  it('shows a hint read with no recorded step among the trailing ones, with no step label', async () => {
    mount({ hints: [hintOf({ id: 'h1', text: SHORT, isRead: true })] });

    await screen.findByText(SHORT);
    expect(readRow()).not.toBeNull();
    expect(screen.queryByText(/Read at step/)).toBeNull();
  });
});

describe('the images of a hint', () => {
  const RETRY = { name: 'Retry' };
  const FAILED = "Images didn't load";

  const imagesHints = [
    hintOf({ id: 'h1', text: SHORT, isWithImages: true, step: 2 }),
    hintOf({ id: 'h2', text: 'Second', isWithImages: true, step: 2 }),
  ];

  it('loads the run once for every row that shows images', async () => {
    listGoalAttachmentsForRun.mockResolvedValue(hintRowsFixture.imageRows());
    mount({ hints: imagesHints });

    await screen.findAllByRole('button', { name: 'Preview relay-log.png' });
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load for the session and every row offers a retry that works', async () => {
    listGoalAttachmentsForRun
      .mockRejectedValueOnce(new Error('db locked'))
      .mockResolvedValue(hintRowsFixture.imageRows());
    const reportError = vi.fn(async () => undefined);
    const view = mount({ hints: imagesHints });
    useAppStore.setState({ reportError });

    await screen.findAllByText(FAILED);
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't load the hint images",
        sessionId: view.seeded.session.id,
      }),
    );
    const retry = screen.getAllByRole('button', RETRY).at(0);
    if (retry === undefined) {
      throw new Error('The retry button is missing.');
    }
    fireEvent.click(retry);

    await screen.findAllByRole('button', { name: 'Preview relay-log.png' });
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(2);
  });

  it('drops the failure when the images arrive another way, without reading again', async () => {
    listGoalAttachmentsForRun.mockRejectedValueOnce(new Error('db locked'));
    const view = mount({ hints: imagesHints });
    await screen.findAllByText(FAILED);

    act(() =>
      useAppStore.setState({
        workflowRunAttachments: { [view.seeded.run.id]: hintRowsFixture.imageRows() },
      }),
    );

    await waitFor(() => expect(screen.queryByText(FAILED)).toBeNull());
    await screen.findAllByRole('button', { name: 'Preview relay-log.png' });
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
  });

  it('says nothing about a load that fails after the rows are gone', async () => {
    let fail: (error: Error) => void = () => undefined;
    listGoalAttachmentsForRun.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const reportError = vi.fn(async () => undefined);
    const view = mount({ hints: imagesHints });
    useAppStore.setState({ reportError });
    view.unmount();

    await act(async () => {
      fail(new Error('db locked'));
      await Promise.resolve();
    });

    expect(reportError).not.toHaveBeenCalled();
  });
});
