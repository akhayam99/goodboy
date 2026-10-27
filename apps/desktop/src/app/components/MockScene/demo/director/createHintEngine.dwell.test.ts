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

const POPOVER = new DOMRect(300, 300, 200, 120);
const CONTROL = new DOMRect(100, 200, 40, 24);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = `
    <button type="button" id="first">First</button>
    <button type="button" id="second">Second</button>
    <div>
      <textarea aria-label="Message to the agent"></textarea>
      <button type="button" aria-label="Attach">+</button>
      <button type="button" aria-label="Send message">Send</button>
    </div>
  `;
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.id === 'wrapper') {
      return new DOMRect(0, 0, 1024, 0);
    }
    return this.id === 'popover' ? POPOVER : CONTROL;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'first',
    label: 'First',
    copy: 'Open the first thing',
    instruction: 'Open the first thing to see its result.',
    result: 'The first thing is open.',
    beat: 0,
    anchor: '#first',
    revealWhen: () => true,
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'second',
    label: 'Second',
    copy: 'Then the second thing',
    instruction: 'Then open the second thing to see its result.',
    result: 'The second thing is open.',
    beat: 0,
    anchor: '#second',
    revealWhen: () => true,
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
];

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
};

type PointerParams = {
  readonly x: number;
  readonly y: number;
};

const pointerAt = ({ x, y }: PointerParams): void => {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.body.dispatchEvent(event);
};

type ElapseParams = {
  readonly ms: number;
};

const elapse = async ({ ms }: ElapseParams): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(ms);
};

const start = () => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'test' ? HINTS : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'test', settledIds: [] });
  const last = (): DemoHintReport | undefined =>
    reports.filter((report) => report.type === 'anchor').at(-1);
  return { engine, reports, last };
};

const openPopover = (): void => {
  const popover = document.createElement('div');
  popover.id = 'popover';
  popover.setAttribute('role', 'dialog');
  document.body.append(popover);
};

describe('the hint engine dwell', () => {
  it('shows the next hint as soon as a step is done, with no dwell', async () => {
    const { engine, last } = start();
    await elapse({ ms: 40 });
    expect(last()).toMatchObject({ hintId: 'first' });
    visitorClick({ selector: '#first' });
    await elapse({ ms: 40 });
    expect(last()).toMatchObject({ hintId: 'second' });
    engine.dispose();
  });

  it('lights the result the last step opened together with the next control', async () => {
    const { engine, last } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    openPopover();
    await elapse({ ms: 1200 });
    const report = last();
    expect(report).toMatchObject({ hintId: 'second' });
    const focus = report?.type === 'anchor' ? report.focus : null;
    expect(focus?.x).toBeLessThanOrEqual(POPOVER.x);
    expect(focus?.y).toBeLessThanOrEqual(POPOVER.y);
    expect((focus?.x ?? 0) + (focus?.width ?? 0)).toBeGreaterThanOrEqual(POPOVER.right);
    expect((focus?.y ?? 0) + (focus?.height ?? 0)).toBeGreaterThanOrEqual(POPOVER.bottom);
    engine.dispose();
  });

  it('lights a popover whose portal wrapper has no height of its own', async () => {
    const { engine, last } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    const wrapper = document.createElement('div');
    wrapper.id = 'wrapper';
    const popover = document.createElement('div');
    popover.id = 'popover';
    wrapper.append(popover);
    document.body.append(wrapper);
    await elapse({ ms: 3200 });
    const report = last();
    const focus = report?.type === 'anchor' ? report.focus : null;
    expect(report).toMatchObject({ hintId: 'second' });
    expect(focus?.width).toBeGreaterThanOrEqual(POPOVER.right - CONTROL.x);
    engine.dispose();
  });

  it('keeps the next hint lit while the pointer rests on the result', async () => {
    const { engine, last } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    openPopover();
    await elapse({ ms: 1000 });
    for (let step = 0; step < 5; step += 1) {
      pointerAt({ x: 350 + step, y: 350 });
      await elapse({ ms: 1000 });
      expect(last()).toMatchObject({ hintId: 'second' });
    }
    engine.dispose();
  });

  it('does not wait on a pointer that stopped over the result', async () => {
    const { engine, last } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    openPopover();
    await elapse({ ms: 1000 });
    pointerAt({ x: 350, y: 350 });
    await elapse({ ms: 4500 });
    expect(last()).toMatchObject({ hintId: 'second' });
    engine.dispose();
  });

  it('does not scroll the page to the next control while a result is open', async () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    const { engine } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    openPopover();
    await elapse({ ms: 3500 });
    expect(scroll).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('never moves focus when a hint appears or changes', async () => {
    const field = document.querySelector<HTMLElement>('#second');
    field?.focus();
    const { engine } = start();
    await elapse({ ms: 40 });
    expect(document.activeElement).toBe(field);
    visitorClick({ selector: '#first' });
    await elapse({ ms: 3000 });
    expect(document.activeElement).toBe(field);
    engine.dispose();
  });

  it('does not hand focus to the composer when the control that opened a view is gone', async () => {
    const control = document.querySelector<HTMLElement>('#first');
    const composer = document.querySelector<HTMLElement>('textarea');
    const { engine } = start();
    control?.focus();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    control?.remove();
    composer?.focus();
    expect(document.activeElement).not.toBe(composer);
    engine.dispose();
  });

  it('lets the visitor use the composer on purpose', async () => {
    const composer = document.querySelector<HTMLElement>('textarea');
    const { engine } = start();
    await elapse({ ms: 40 });
    visitorClick({ selector: 'textarea' });
    composer?.focus();
    expect(document.activeElement).toBe(composer);
    engine.dispose();
  });

  it('keeps the control the visitor used in focus when the composer asks for it right after', async () => {
    const control = document.querySelector<HTMLElement>('#first');
    const composer = document.querySelector<HTMLElement>('textarea');
    const { engine } = start();
    control?.focus();
    await elapse({ ms: 40 });
    visitorClick({ selector: '#first' });
    composer?.focus();
    expect(document.activeElement).toBe(control);
    engine.dispose();
  });
});
