// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { BOARD_STORY_SESSION } from '../../scenes/BoardScene';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { FIND_HINTS } from './findHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const dwell = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(4600);
};

const visitorClick = (selector: string): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
};

const BOARD_DOM = `
  <article data-select-id="${BOARD_STORY_SESSION}"><button type="button">Open</button></article>
`;

type TabsParams = {
  readonly selected: number;
};

const tabsDom = ({ selected }: TabsParams): string => `
  <div role="tablist" aria-label="Artifact kind">
    ${[1, 2, 3]
      .map(
        (index) => `<button role="tab" aria-selected="${index === selected}">Tab ${index}</button>`,
      )
      .join('')}
  </div>
`;

const ROW =
  '<button data-artifact-row aria-label="Report Retried webhooks no longer double credit">Row</button>';
const DETAILS = '<button data-testid="artifact-drawer-details">Details</button>';

describe('the Find steps', () => {
  it('lists the board card first, then the library report and its details', () => {
    expect(FIND_HINTS.map((hint) => hint.id)).toEqual([
      'board-open',
      'library-reports',
      'report-open',
      'report-details',
    ]);
  });

  it('walks the card, the Reports tab, the report and its details, each after its own action', async () => {
    document.body.innerHTML = BOARD_DOM;
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => FIND_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    const shown = (): string | null =>
      reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : [])).at(-1) ?? null;
    engine.setTrack({ chapterId: 'find', settledIds: [] });
    await frame();
    expect(shown()).toBe('board-open');
    expect(tried()).toEqual([]);

    store.setState({ currentSessionId: BOARD_STORY_SESSION });
    await frame();
    expect(tried()).toEqual(['board-open']);

    document.body.innerHTML = tabsDom({ selected: 1 });
    await dwell();
    expect(shown()).toBe('library-reports');
    document.body.innerHTML = tabsDom({ selected: 3 });
    await frame();
    expect(tried()).toEqual(['board-open', 'library-reports']);

    document.body.innerHTML = tabsDom({ selected: 3 }) + ROW;
    await dwell();
    expect(shown()).toBe('report-open');
    document.body.innerHTML = tabsDom({ selected: 3 }) + ROW + DETAILS;
    await frame();
    expect(tried()).toEqual(['board-open', 'library-reports', 'report-open']);

    await dwell();
    expect(shown()).toBe('report-details');
    visitorClick('[data-testid="artifact-drawer-details"]');
    await frame();
    expect(tried()).toEqual(['board-open', 'library-reports', 'report-open', 'report-details']);
    engine.dispose();
  });
});
