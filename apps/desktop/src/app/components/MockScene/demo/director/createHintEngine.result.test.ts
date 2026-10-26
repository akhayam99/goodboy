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
import type { DemoHint } from '../hints/demoHintTypes';
import { createHintEngine } from './createHintEngine';
import type { DemoHintReport } from './demoProtocol';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = `
    <button type="button" id="first">First</button>
    <button type="button" id="second">Second</button>
  `;
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

const FIRST: DemoHint = {
  id: 'first',
  label: 'First',
  copy: 'Open the first thing',
  instruction: 'Open the first thing to see its result.',
  result: 'The first thing is open.',
  beat: 0,
  dwellMs: 4500,
  anchor: '#first',
  settle: ({ root }) => {
    root.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  },
  revealWhen: () => true,
  doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
};

const SECOND: DemoHint = {
  id: 'second',
  label: 'Second',
  copy: 'Then the second thing',
  instruction: 'Then open the second thing to see its result.',
  result: 'The second thing is open.',
  beat: 0,
  anchor: '#second',
  revealWhen: () => true,
  doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
};

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
};

type ElapseParams = {
  readonly ms: number;
};

const elapse = async ({ ms }: ElapseParams): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(ms);
};

type StartParams = {
  readonly hints?: ReadonlyArray<DemoHint>;
};

const start = ({ hints = [FIRST, SECOND] }: StartParams = {}) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'test' ? hints : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'test', settledIds: [] });
  const last = (): DemoHintReport | undefined =>
    reports.filter((report) => report.type === 'anchor').at(-1);
  return { engine, last };
};

describe('a result held for its own dwell', () => {
  it('keeps the result for the hint dwell and closes it once, after the dwell', async () => {
    const closed = vi.fn();
    document.addEventListener('pointerdown', closed);
    const { engine, last } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    await elapse({ ms: 3000 });
    expect(last()).toMatchObject({ hintId: null });
    expect(closed).not.toHaveBeenCalled();
    await elapse({ ms: 2000 });
    expect(closed).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({ hintId: 'second' });
    await elapse({ ms: 3000 });
    expect(closed).toHaveBeenCalledTimes(1);
    document.removeEventListener('pointerdown', closed);
    engine.dispose();
  });

  it('reports the press so the coach lifts only for the pressed control', async () => {
    const { engine, last } = start({
      hints: [{ ...FIRST, doneWhen: () => false }, SECOND],
    });
    await elapse({ ms: 40 });
    expect(last()).toMatchObject({ hintId: 'first', isPressed: false });
    visitorClick({ selector: '#second' });
    await elapse({ ms: 40 });
    expect(last()).toMatchObject({ hintId: 'first', isPressed: false });
    visitorClick({ selector: '#first' });
    await elapse({ ms: 40 });
    expect(last()).toMatchObject({ isPressed: true });
    engine.dispose();
  });
});
