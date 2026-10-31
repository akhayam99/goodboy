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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { HintRowsBody } from './testing/HintRowsBody';
import { hintRowsFixture } from './testing/hintRowsFixture';

const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');
const LONG = 'Cover refunds.\nThen check the webhook timeout.';
const ROW_HEIGHT = 96;
const MARKER_Y = 16;

type HintParams = {
  readonly id: string;
  readonly step?: number;
  readonly isWithImages?: boolean;
};

const hintOf = ({ id, step, isWithImages = false }: HintParams): OrchestratorHint => ({
  id,
  text: LONG,
  createdAt: AT,
  consumedAt: AT,
  ...(step === undefined ? {} : { consumedAtStep: step }),
  ...(isWithImages ? { attachmentIds: hintRowsFixture.imageIds } : {}),
});

type Span = {
  readonly top: number;
  readonly bottom: number;
  readonly stroke: string | null;
  readonly dash: string | null;
};

const spansIn = ({ root }: { readonly root: Element }): ReadonlyArray<Span> =>
  Array.from(root.querySelectorAll('[data-testid="timeline-rail-segment"]')).map((line) => ({
    top: Number(line.getAttribute('y1')),
    bottom: Number(line.getAttribute('y2')),
    stroke: line.getAttribute('stroke'),
    dash: line.getAttribute('stroke-dasharray'),
  }));

const hintRail = (): Element => {
  const rail = document.querySelector('[data-hint-chip="read"] [data-hint-rail]');
  if (rail === null) {
    throw new Error('The hint rail is missing.');
  }
  return rail;
};

const mount = ({
  hints,
  agentCount,
}: {
  hints: ReadonlyArray<OrchestratorHint>;
  agentCount: number;
}) => {
  const seeded = hintRowsFixture.seed({ hints, agentCount, isLoaded: false });
  render(<HintRowsBody {...seeded} />);
  return seeded;
};

let resize: FakeResizeObservers;
let height = ROW_HEIGHT;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listGoalAttachmentsForRun.mockReset();
  stubStoryInvoke({ attachment_read: 'data:image/png;base64,AAAA' });
  resize = installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  height = ROW_HEIGHT;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the line through a hint on the run track', () => {
  it('runs from the step above to the step below, whole row and image row included', () => {
    const seeded = mount({
      hints: [hintOf({ id: 'h1', step: 3, isWithImages: true })],
      agentCount: 3,
    });
    const [span] = spansIn({ root: hintRail() });
    expect(spansIn({ root: hintRail() })).toHaveLength(1);
    expect(span?.top).toBeLessThanOrEqual(0);
    expect(span?.bottom).toBeGreaterThanOrEqual(ROW_HEIGHT);
    const stepAbove = screen.getByTestId(`run-tree-row-${seeded.agents[1]?.id}`);
    const stepBelow = screen.getByTestId(`run-tree-row-${seeded.agents[2]?.id}`);
    expect(spansIn({ root: stepAbove }).at(-1)?.bottom).toBeGreaterThan(0);
    const into = spansIn({ root: stepBelow })[0];
    expect(span?.stroke).toBe(into?.stroke);
    expect(span?.dash).toBe(into?.dash);
  });

  it('stays continuous when the hint has no images', () => {
    mount({ hints: [hintOf({ id: 'h1', step: 3 })], agentCount: 3 });
    const [span] = spansIn({ root: hintRail() });
    expect(span?.top).toBeLessThanOrEqual(0);
    expect(span?.bottom).toBeGreaterThanOrEqual(ROW_HEIGHT);
  });

  it('follows the row when the hint is expanded', () => {
    mount({ hints: [hintOf({ id: 'h1', step: 3 })], agentCount: 3 });
    fireEvent.click(screen.getByRole('button', { name: /^Show more of hint: / }));
    height = 180;
    act(() => resize.resizeAll());
    const [span] = spansIn({ root: hintRail() });
    expect(span?.top).toBeLessThanOrEqual(0);
    expect(span?.bottom).toBeGreaterThanOrEqual(180);
  });

  it('has a line above and none below for a hint after the last step', () => {
    mount({ hints: [hintOf({ id: 'h1' })], agentCount: 3 });
    const spans = spansIn({ root: hintRail() });
    expect(spans).toHaveLength(1);
    expect(spans[0]?.top).toBeLessThanOrEqual(0);
    expect(spans[0]?.bottom).toBe(MARKER_Y);
  });

  it('continues between trailing hints and ends at the last one', () => {
    mount({
      hints: [hintOf({ id: 'h1' }), hintOf({ id: 'h2', step: 9 }), hintOf({ id: 'h3' })],
      agentCount: 3,
    });
    const rails = Array.from(document.querySelectorAll('[data-hint-chip="read"] [data-hint-rail]'));
    expect(rails).toHaveLength(3);
    const [first, middle, last] = rails.map((rail) => spansIn({ root: rail }));
    expect(first).toHaveLength(1);
    expect(first?.[0]?.bottom).toBeGreaterThanOrEqual(ROW_HEIGHT);
    expect(middle?.[0]?.bottom).toBeGreaterThanOrEqual(ROW_HEIGHT);
    expect(last).toHaveLength(1);
    expect(last?.[0]?.bottom).toBe(MARKER_Y);
  });

  it('draws nothing above the first step', () => {
    mount({ hints: [hintOf({ id: 'h1', step: 1 })], agentCount: 3 });
    expect(document.querySelector('[data-hint-chip="read"] [data-hint-rail]')).toBeNull();
  });
});
