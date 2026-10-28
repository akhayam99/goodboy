// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
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

type StepParams = Partial<DemoHint> & {
  readonly id: string;
};

const step = ({ id, ...overrides }: StepParams): DemoHint => ({
  id,
  label: id,
  copy: `Copy of ${id}`,
  instruction: `Do ${id}.`,
  result: `Done ${id}.`,
  beat: 0,
  anchor: `#${id}`,
  revealWhen: () => true,
  doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  ...overrides,
});

const BUTTONS = `
  <button type="button" id="open">Open</button>
  <button type="button" id="read">Read</button>
  <button type="button" id="keep">Keep</button>
`;

const STORY: ReadonlyArray<DemoHint> = [
  step({ id: 'open' }),
  step({ id: 'read' }),
  step({ id: 'keep' }),
];

type TrackParams = {
  readonly chapterId: string;
};

type EngineParams = {
  readonly hints: ReadonlyArray<DemoHint>;
};

type GenerationParams = {
  readonly next: number;
};

const engineFor = ({ hints }: EngineParams) => {
  const reports: DemoHintReport[] = [];
  let generation = 0;
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => generation,
    hintsOf: ({ chapterId }: TrackParams) => (chapterId === 'test' ? hints : []),
    onReport: ({ report }) => reports.push(report),
  });
  const shown = (): ReadonlyArray<string | null> =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : []));
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const setGeneration = ({ next }: GenerationParams) => {
    generation = next;
  };
  return { engine, reports, shown, tried, setGeneration };
};

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const dwell = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(2700);
};

type ClickParams = {
  readonly selector: string;
  readonly isTrusted?: boolean;
};

const click = ({ selector, isTrusted = true }: ClickParams): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: isTrusted });
  document.querySelector(selector)?.dispatchEvent(event);
};

describe('the hint engine', () => {
  it('follows a control that moves without any change to the page', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, reports } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue(
      new DOMRect(100, 300, 40, 24),
    );
    vi.advanceTimersByTime(300);
    expect(reports.at(-1)).toMatchObject({ type: 'anchor', rect: { y: 300 } });
    engine.dispose();
  });

  it('stays silent until the shell names a track', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, reports } = engineFor({ hints: STORY });
    await frame();
    expect(reports).toEqual([]);
    engine.dispose();
  });

  it('lights only the first step that is not settled, even when a later control is on screen', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, reports, shown } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('open');
    expect(reports.at(-1)).toMatchObject({
      type: 'anchor',
      rect: { x: 100, y: 200, width: 40, height: 24 },
    });
    document.querySelector('#open')?.remove();
    await frame();
    expect(shown().at(-1)).toBeNull();
    engine.dispose();
  });

  it('never credits a later step before the earlier one is done', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, tried } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    click({ selector: '#keep' });
    await frame();
    expect(tried()).toEqual([]);
    click({ selector: '#open' });
    await frame();
    expect(tried()).toEqual(['open']);
    await dwell();
    click({ selector: '#read' });
    await frame();
    expect(tried()).toEqual(['open', 'read']);
    engine.dispose();
  });

  it('credits steps whose result is already on screen in one pass, in order', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, tried } = engineFor({
      hints: [
        step({ id: 'open', doneWhen: () => true }),
        step({ id: 'read', doneWhen: () => true }),
      ],
    });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(tried()).toEqual(['open', 'read']);
    engine.dispose();
  });

  it('lights the next step in the same frame the previous one is done, with no wait', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, shown } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    click({ selector: '#open' });
    await frame();
    expect(shown().at(-1)).toBe('read');
    engine.dispose();
  });

  it('counts from when a step became eligible, not from a store that was still loading', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, tried } = engineFor({
      hints: [
        step({
          id: 'open',
          revealWhen: ({ state }) => state.sessions.length > 0,
          doneWhen: ({ state, start }) => state.sessions.length > start.sessions.length,
        }),
      ],
    });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    store.setState({ sessions: [aSession({ goal: 'First' })] });
    await frame();
    expect(tried()).toEqual([]);
    store.setState({ sessions: [aSession({ goal: 'First' }), aSession({ goal: 'Second' })] });
    await frame();
    expect(tried()).toEqual(['open']);
    engine.dispose();
  });

  it('skips settled steps and offers them again after a reset of the track', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, shown } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: ['open'] });
    await frame();
    expect(shown().at(-1)).toBe('read');
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('open');
    engine.dispose();
  });

  it('tags reports with the generation and forgets progress made before a restart', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, reports, tried, setGeneration } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    click({ selector: '#open' });
    await frame();
    expect(tried()).toEqual(['open']);
    setGeneration({ next: 1 });
    engine.reset();
    await frame();
    expect(reports.at(-1)).toMatchObject({ type: 'anchor', generation: 1, hintId: 'open' });
    click({ selector: '#open' });
    await frame();
    expect(tried()).toEqual(['open', 'open']);
    engine.dispose();
  });

  it('says the visitor clicked the lit control, so the shell can lift the spotlight', async () => {
    document.body.innerHTML = BUTTONS;
    const { engine, reports } = engineFor({
      hints: [step({ id: 'open', doneWhen: () => false })],
    });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(reports.at(-1)).toMatchObject({ type: 'anchor', hintId: 'open', isClicked: false });
    click({ selector: '#open', isTrusted: false });
    await frame();
    expect(reports.at(-1)).toMatchObject({ hintId: 'open', isClicked: false });
    click({ selector: '#open' });
    await frame();
    expect(reports.at(-1)).toMatchObject({ type: 'anchor', hintId: 'open', isClicked: true });
    engine.dispose();
  });

  it('flags a control scrolled out of view and scrolls it in on request', async () => {
    document.body.innerHTML = BUTTONS;
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.tagName === 'BUTTON'
        ? new DOMRect(100, window.innerHeight + 400, 40, 24)
        : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    });
    const { engine, reports } = engineFor({ hints: STORY });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(reports.at(-1)).toMatchObject({
      type: 'anchor',
      hintId: 'open',
      rect: null,
      isOffscreen: true,
    });
    engine.reveal({ hintId: 'open' });
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    engine.dispose();
  });

  describe('focus region', () => {
    const probeHint = (overrides: Partial<DemoHint>): DemoHint =>
      step({ id: 'go', doneWhen: () => false, ...overrides });

    const boxed = (): void => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const [x = 0, y = 0, width = 0, height = 0] = (this.getAttribute('data-box') ?? '')
          .split(',')
          .map(Number);
        return this.hasAttribute('data-box')
          ? new DOMRect(x, y, width, height)
          : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      });
    };

    const lastAnchor = (reports: ReadonlyArray<DemoHintReport>) =>
      reports.filter((report) => report.type === 'anchor').at(-1);

    it('reports the region the hint names, found from the control outward', async () => {
      document.body.innerHTML = `
        <section data-box="40,40,700,500">
          <div id="inner" data-box="60,80,400,200">
            <button id="go" data-box="100,100,40,24"></button>
          </div>
        </section>
      `;
      boxed();
      const { engine, reports } = engineFor({ hints: [probeHint({ focus: '#inner' })] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(lastAnchor(reports)).toMatchObject({
        hintId: 'go',
        rect: { x: 100, y: 100, width: 40, height: 24 },
        focus: { x: 60, y: 80, width: 400, height: 200 },
      });
      engine.dispose();
    });

    it('falls back to the nearest container that holds more than the control', async () => {
      document.body.innerHTML = `
        <section data-box="40,40,600,300">
          <span data-box="100,100,40,24"><button id="go" data-box="100,100,40,24"></button></span>
        </section>
      `;
      boxed();
      const { engine, reports } = engineFor({ hints: [probeHint({})] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(lastAnchor(reports)).toMatchObject({
        focus: { x: 40, y: 40, width: 600, height: 300 },
      });
      engine.dispose();
    });

    it('reports no region when the only container is most of the screen', async () => {
      document.body.innerHTML = `
        <section data-box="0,0,1000,760">
          <button id="go" data-box="100,100,40,24"></button>
        </section>
      `;
      boxed();
      const { engine, reports } = engineFor({ hints: [probeHint({})] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(lastAnchor(reports)).toMatchObject({ hintId: 'go', focus: null });
      engine.dispose();
    });

    it('reports nothing to light for a hint whose control is not on the page', async () => {
      document.body.innerHTML = '<section data-box="0,0,300,300"></section>';
      boxed();
      const { engine, reports } = engineFor({ hints: [probeHint({})] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(lastAnchor(reports)).toMatchObject({ hintId: null, rect: null, focus: null });
      engine.dispose();
    });

    it('scrolls a control that is cut by the edge into view once, then leaves the scroll alone', async () => {
      const edge = window.innerHeight - 20;
      document.body.innerHTML = `<button id="go" data-box="100,${edge},40,24"></button>`;
      const scrolled = vi.fn();
      Element.prototype.scrollIntoView = scrolled;
      boxed();
      const { engine } = engineFor({ hints: [probeHint({})] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(scrolled).toHaveBeenCalledTimes(1);
      expect(scrolled).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
      document.body.dispatchEvent(new Event('scroll'));
      await frame();
      expect(scrolled).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('scrolls a control below the fold in before offering Show control', async () => {
      document.body.innerHTML = `<button id="go" data-box="100,${window.innerHeight + 400},40,24"></button>`;
      const scrolled = vi.fn();
      Element.prototype.scrollIntoView = scrolled;
      boxed();
      const { engine, reports } = engineFor({ hints: [probeHint({})] });
      engine.setTrack({ chapterId: 'test', settledIds: [] });
      await frame();
      expect(scrolled).toHaveBeenCalledTimes(1);
      expect(lastAnchor(reports)).toMatchObject({ hintId: 'go', rect: null, isOffscreen: true });
      engine.dispose();
    });
  });
});
