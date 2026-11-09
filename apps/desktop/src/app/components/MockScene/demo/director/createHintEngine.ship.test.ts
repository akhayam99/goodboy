// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SHIP_HINTS } from '../hints/shipHints';
import { createHintEngine } from './createHintEngine';
import type { DemoHintReport } from './demoProtocol';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const HEADER_RECT = new DOMRect(500, 20, 90, 28);
const DRAWER_RECT = new DOMRect(500, 500, 90, 28);
const OTHER_RECT = new DOMRect(0, 0, 1000, 700);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    if (this.matches('[data-branch-primary], [data-branch-secondary]')) {
      return HEADER_RECT;
    }
    if (this.matches('[data-review-verb]')) {
      return DRAWER_RECT;
    }
    return OTHER_RECT;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type StartParams = {
  readonly settledIds: ReadonlyArray<string>;
};

const start = ({ settledIds }: StartParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'ship' ? SHIP_HINTS : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'ship', settledIds, isGuarding: true });
  const lastAnchor = () =>
    reports.findLast((report) => report.type === 'anchor' && report.hintId !== null);
  const blocked = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : []));
  return { engine, lastAnchor, blocked };
};

const elapse = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(40);
};

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): boolean => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
  return event.defaultPrevented;
};

const BRANCH_PAGE = `
  <button type="button" data-branch-primary="step.apply">Apply fix</button>
  <button type="button" data-review-verb="reviewComment.accept">Apply fix</button>
  <button type="button" id="other">Other</button>
`;

describe('the ship hints on the real branch page', () => {
  it('lights Rebase on the branch header primary button', async () => {
    document.body.innerHTML =
      '<button type="button" data-branch-primary="diff.rebase">Rebase on main</button>';
    const { engine, lastAnchor } = start({ settledIds: ['fix-start', 'fix-apply'] });
    await elapse();
    expect(lastAnchor()).toMatchObject({ hintId: 'fix-rebase', rect: { y: HEADER_RECT.y } });
    engine.dispose();
  });

  it('lights Rebase when the header offers it as the secondary action', async () => {
    document.body.innerHTML =
      '<button type="button" data-branch-secondary="diff.rebase">Rebase on main</button>';
    const { engine, lastAnchor } = start({ settledIds: ['fix-start', 'fix-apply'] });
    await elapse();
    expect(lastAnchor()).toMatchObject({ hintId: 'fix-rebase' });
    engine.dispose();
  });

  it('lets the visitor press Rebase and blocks every other control meanwhile', async () => {
    document.body.innerHTML = `
      <button type="button" data-branch-primary="diff.rebase">Rebase on main</button>
      <button type="button" id="other">Other</button>
    `;
    const { engine, blocked } = start({ settledIds: ['fix-start', 'fix-apply'] });
    await elapse();
    expect(visitorClick({ selector: '[data-branch-primary]' })).toBe(false);
    expect(visitorClick({ selector: '#other' })).toBe(true);
    await elapse();
    expect(blocked()).toEqual(['fix-rebase']);
    engine.dispose();
  });

  it('points Apply fix at the visible header button first', async () => {
    document.body.innerHTML = BRANCH_PAGE;
    const { engine, lastAnchor } = start({ settledIds: ['fix-start'] });
    await elapse();
    expect(lastAnchor()).toMatchObject({ hintId: 'fix-apply', rect: { y: HEADER_RECT.y } });
    engine.dispose();
  });

  it('still lights Apply fix on the drawer button when the header has none', async () => {
    document.body.innerHTML = `
      <button type="button" data-review-verb="reviewComment.accept">Apply fix</button>
    `;
    const { engine, lastAnchor } = start({ settledIds: ['fix-start'] });
    await elapse();
    expect(lastAnchor()).toMatchObject({ hintId: 'fix-apply', rect: { y: DRAWER_RECT.y } });
    engine.dispose();
  });

  it('accepts a press on either Apply fix and blocks any other control', async () => {
    document.body.innerHTML = BRANCH_PAGE;
    const { engine, blocked } = start({ settledIds: ['fix-start'] });
    await elapse();
    expect(visitorClick({ selector: '[data-branch-primary]' })).toBe(false);
    expect(visitorClick({ selector: '[data-review-verb]' })).toBe(false);
    expect(blocked()).toEqual([]);
    expect(visitorClick({ selector: '#other' })).toBe(true);
    await elapse();
    expect(blocked()).toEqual(['fix-apply']);
    engine.dispose();
  });
});
