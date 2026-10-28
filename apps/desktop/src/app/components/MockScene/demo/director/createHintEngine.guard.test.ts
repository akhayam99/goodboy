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
    <button type="button" id="connect">Connect</button>
    <input type="text" id="field" />
    <button type="button" id="continue">Continue</button>
    <button type="button" id="other">Other</button>
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

const HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'connect',
    label: 'Connect',
    copy: 'Connect the tool',
    instruction: 'Connect the tool first.',
    result: 'The tool is connected.',
    beat: 0,
    anchor: '#connect',
    revealWhen: () => true,
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'continue',
    label: 'Continue',
    copy: 'Keep the tools',
    instruction: 'Continue once the tool is connected.',
    result: 'The tools are kept.',
    beat: 0,
    anchor: '#continue',
    revealWhen: () => true,
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];

type TrustedParams = {
  readonly event: Event;
};

const trusted = ({ event }: TrustedParams): Event => {
  Object.defineProperty(event, 'isTrusted', { value: true });
  return event;
};

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): boolean => {
  const target = document.querySelector(selector);
  const event = trusted({ event: new MouseEvent('click', { bubbles: true, cancelable: true }) });
  target?.dispatchEvent(event);
  return event.defaultPrevented;
};

type KeyParams = {
  readonly selector: string;
  readonly key: string;
};

const visitorKey = ({ selector, key }: KeyParams): boolean => {
  const target = document.querySelector(selector) ?? document.body;
  const event = trusted({
    event: new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

const elapse = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(40);
};

type StartParams = {
  readonly isGuarding: boolean;
  readonly hints?: ReadonlyArray<DemoHint>;
};

const start = ({ isGuarding, hints = HINTS }: StartParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'test' ? hints : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'test', settledIds: [], isGuarding });
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const blocked = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : []));
  return { engine, tried, blocked };
};

const EXCLUSIVE: ReadonlyArray<DemoHint> = HINTS.map((hint) => ({
  ...hint,
  isBlocked: ({ target }) => target.closest('#other') !== null,
}));

describe('the skip guard', () => {
  it('stops a click and an Enter on a control the active step names as blocked', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true, hints: EXCLUSIVE });
    await elapse();
    expect(visitorClick({ selector: '#other' })).toBe(true);
    expect(visitorKey({ selector: '#other', key: 'Enter' })).toBe(true);
    await elapse();
    expect(blocked()).toEqual(['connect', 'connect']);
    expect(tried()).toEqual([]);
    engine.dispose();
  });

  it('leaves the keys that only move focus on a blocked control alone', async () => {
    const { engine, blocked } = start({ isGuarding: true, hints: EXCLUSIVE });
    await elapse();
    expect(visitorKey({ selector: '#other', key: 'Tab' })).toBe(false);
    expect(visitorKey({ selector: '#other', key: 'ArrowDown' })).toBe(false);
    await elapse();
    expect(blocked()).toEqual([]);
    engine.dispose();
  });

  it('still lets the visitor press the control of the active step', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true, hints: EXCLUSIVE });
    await elapse();
    expect(visitorClick({ selector: '#connect' })).toBe(false);
    await elapse();
    expect(blocked()).toEqual([]);
    expect(tried()).toEqual(['connect']);
    engine.dispose();
  });

  it('stops a click on the control of a later step and points back at the active one', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true });
    await elapse();
    expect(visitorClick({ selector: '#continue' })).toBe(true);
    await elapse();
    expect(blocked()).toEqual(['connect']);
    expect(tried()).toEqual([]);
    engine.dispose();
  });

  it('stops Enter and Space on the later control, and Enter pressed anywhere else', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true });
    await elapse();
    expect(visitorKey({ selector: '#continue', key: 'Enter' })).toBe(true);
    expect(visitorKey({ selector: '#continue', key: ' ' })).toBe(true);
    expect(visitorKey({ selector: 'body', key: 'Enter' })).toBe(true);
    expect(blocked()).toEqual(['connect', 'connect', 'connect']);
    expect(tried()).toEqual([]);
    engine.dispose();
  });

  it('lets the visitor use the control of the active step and type in a field', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true });
    await elapse();
    expect(visitorKey({ selector: '#field', key: 'Enter' })).toBe(false);
    expect(visitorKey({ selector: '#connect', key: 'Enter' })).toBe(false);
    expect(visitorClick({ selector: '#connect' })).toBe(false);
    await elapse();
    expect(blocked()).toEqual([]);
    expect(tried()).toEqual(['connect']);
    engine.dispose();
  });

  it('lets the later control through once its own step is the active one', async () => {
    const { engine, tried, blocked } = start({ isGuarding: true });
    await elapse();
    visitorClick({ selector: '#connect' });
    await elapse();
    expect(visitorClick({ selector: '#continue' })).toBe(false);
    await elapse();
    expect(tried()).toEqual(['connect', 'continue']);
    expect(blocked()).toEqual([]);
    engine.dispose();
  });

  it('does not guard when the visitor hid the hints', async () => {
    const { engine, tried, blocked } = start({ isGuarding: false });
    await elapse();
    expect(visitorClick({ selector: '#continue' })).toBe(false);
    await elapse();
    expect(blocked()).toEqual([]);
    expect(tried()).toEqual([]);
    engine.dispose();
  });

  it('ignores a click the scene made on its own', async () => {
    const { engine, blocked } = start({ isGuarding: true });
    await elapse();
    document.querySelector<HTMLElement>('#continue')?.click();
    await elapse();
    expect(blocked()).toEqual([]);
    engine.dispose();
  });
});
