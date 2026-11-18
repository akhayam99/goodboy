// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_PROTOCOL, type DemoRect, type DemoReportType } from './director/demoProtocol';
import { HINT_PROGRESS_KEY } from './hints/hintProgressKey';
import { dwellOf } from './hints/dwellOf';
import { RESULT_DWELL_MS } from './hints/resultDwellMs';

const visibleFrame = (): HTMLIFrameElement => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-shown="true"]');
  if (frame === null) {
    throw new Error('no visible frame');
  }
  return frame;
};

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

type ReportParams = {
  readonly frame: HTMLIFrameElement;
  readonly type: DemoReportType;
  readonly generation?: number;
  readonly source?: MessageEventSource | null;
};

const report = ({ frame, type, generation = 0, source = frame.contentWindow }: ReportParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation,
          type,
          elapsedMs: 0,
          durationMs: 0,
          cueIndex: 0,
        },
        origin: window.location.origin,
        source,
      }),
    );
  });
};

type SrcParams = {
  readonly scene: string;
};

const frameOf = ({ scene }: SrcParams): HTMLIFrameElement => {
  const frame = Array.from(document.querySelectorAll('iframe')).find((entry) =>
    (entry.getAttribute('src') ?? '').includes(`scene=${scene}&`),
  );
  if (frame === undefined) {
    throw new Error(`no frame for ${scene}`);
  }
  return frame;
};

type HintParams = {
  readonly frame: HTMLIFrameElement;
  readonly hintId: string | null;
  readonly rect?: DemoRect | null;
  readonly focus?: DemoRect | null;
  readonly isOffscreen?: boolean;
  readonly isClicked?: boolean;
  readonly isPressed?: boolean;
  readonly generation?: number;
  readonly source?: MessageEventSource | null;
};

const hint = ({
  frame,
  hintId,
  rect = { x: 900, y: 700, width: 28, height: 28 },
  focus = null,
  isOffscreen = false,
  isClicked = false,
  isPressed = false,
  generation = 0,
  source = frame.contentWindow,
}: HintParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation,
          type: 'anchor',
          hintId,
          rect,
          focus,
          isOffscreen,
          isClicked,
          isPressed,
        },
        origin: window.location.origin,
        source,
      }),
    );
  });
};

type TriedParams = {
  readonly frame: HTMLIFrameElement;
  readonly hintId: string;
};

type SignalParams = TriedParams & {
  readonly type: 'tried' | 'blocked';
};

const signal = ({ frame, hintId, type }: SignalParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: 0,
          type,
          hintId,
        },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );
  });
};

const tried = ({ frame, hintId }: TriedParams) => signal({ frame, hintId, type: 'tried' });

const blocked = ({ frame, hintId }: TriedParams) => signal({ frame, hintId, type: 'blocked' });

const WARNING = 'Follow the outlined control first.';

type ElapseParams = {
  readonly ms: number;
};

const elapse = ({ ms }: ElapseParams) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

type ChapterParams = {
  readonly id: string;
};

const chapterOf = ({ id }: ChapterParams) => {
  const chapter = DEMO_CHAPTERS.find((entry) => entry.id === id);
  if (chapter === undefined) {
    throw new Error(`no chapter ${id}`);
  }
  return chapter;
};

type DoneParams = {
  readonly ids: ReadonlyArray<string>;
};

const idsOf = ({ id }: ChapterParams): ReadonlyArray<string> =>
  chapterOf({ id }).hints.map((entry) => entry.id);

const seedProgress = ({ ids }: DoneParams) => {
  window.sessionStorage.setItem(
    HINT_PROGRESS_KEY,
    JSON.stringify(Object.fromEntries(ids.map((id) => [id, { tried: idsOf({ id }), epoch: 0 }]))),
  );
};

const playgroundRoot = (): HTMLElement => {
  const root = screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('[tabindex="-1"]');
  if (root === null) {
    throw new Error('missing playground root');
  }
  return root;
};

const topBar = (): HTMLElement => {
  const bar = document.querySelector<HTMLElement>('body > div header, header');
  if (bar === null) {
    throw new Error('missing top bar');
  }
  return bar;
};

const railOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Playground groups' });

const groupRows = (): ReadonlyArray<HTMLButtonElement> =>
  Array.from(railOf().querySelectorAll<HTMLButtonElement>('button[data-access]'));

type RowParams = {
  readonly title: string;
};

const rowOf = ({ title }: RowParams): HTMLButtonElement => {
  const row = groupRows().find((entry) => entry.textContent?.includes(title));
  if (row === undefined) {
    throw new Error(`no row ${title}`);
  }
  return row;
};

const stepStates = (): ReadonlyArray<string | null> =>
  Array.from(railOf().querySelectorAll('ol[aria-label="Steps in this group"] li')).map((step) =>
    step.getAttribute('data-state'),
  );

const instruction = (): string => screen.getByTestId('demo-instruction').textContent ?? '';

beforeEach(() => {
  window.sessionStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(STAGE_BOX);
  window.history.replaceState(null, '', '/?scene=demo');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(Animation.prototype, 'cancel').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('demo playground stage states', () => {
  it('draws the coach only once the new frame has faded in after a group switch', () => {
    seedProgress({ ids: ['bring'] });
    window.history.replaceState(null, '', '/?scene=demo#direction');
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    fireEvent.click(rowOf({ title: 'Bring your repositories' }));
    const next = frameOf({ scene: chapterOf({ id: 'bring' }).beats[0]?.scene ?? '' });
    report({ frame: next, type: 'ready' });
    expect(visibleFrame()).toBe(next);
    hint({ frame: next, hintId: chapterOf({ id: 'bring' }).hints[0]?.id ?? '' });
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    elapse({ ms: 319 });
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    elapse({ ms: 1 });
    expect(screen.queryByTestId('demo-coach-mark')).not.toBeNull();
  });

  it('warms the next group as soon as the first step of this one is done', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const nextScene = chapterOf({ id: 'direction' }).beats[0]?.scene ?? '';
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    tried({ frame, hintId: chapterOf({ id: 'bring' }).hints[0]?.id ?? '' });
    expect(document.querySelectorAll('iframe')).toHaveLength(2);
    expect(frameOf({ scene: nextScene }).hasAttribute('inert')).toBe(true);
    expect(visibleFrame()).toBe(frame);
  });

  describe('when a group is done', () => {
    const dwellOfLast = ({ id }: ChapterParams): number => {
      const last = chapterOf({ id }).hints.at(-1);
      return last === undefined ? RESULT_DWELL_MS : dwellOf({ hint: last });
    };

    const finishBring = () => {
      render(<DemoPlayground />);
      const frame = visibleFrame();
      report({ frame, type: 'ready' });
      const { hints } = chapterOf({ id: 'bring' });
      for (const entry of hints.slice(0, -1)) {
        tried({ frame, hintId: entry.id });
        elapse({ ms: dwellOf({ hint: entry }) });
      }
      const last = hints.at(-1);
      tried({ frame, hintId: last?.id ?? '' });
      return { frame, last };
    };

    const heading = (): string => screen.getByRole('heading', { level: 1 }).textContent ?? '';

    it('keeps the last result on the open frame for its dwell, with nothing to click', () => {
      const { frame, last } = finishBring();
      const result = last?.result.replaceAll('**', '');
      expect(instruction()).toBe(result);
      expect(frame.hasAttribute('inert')).toBe(false);
      expect(within(screen.getByTestId('demo-stage')).queryAllByRole('button')).toHaveLength(0);
      elapse({ ms: dwellOfLast({ id: 'bring' }) - 1 });
      expect(heading()).toBe('Bring your repositories');
      expect(instruction()).toBe(result);
    });

    it('opens the next group by itself once the dwell ends, as Next would', () => {
      finishBring();
      const historyLength = window.history.length;
      elapse({ ms: dwellOfLast({ id: 'bring' }) });
      expect(window.location.hash).toBe('#direction');
      expect(window.history.length).toBe(historyLength + 1);
      expect(heading()).toBe('Set the direction');
      expect(rowOf({ title: 'Set the direction' }).getAttribute('aria-current')).toBe('page');
      expect(rowOf({ title: 'Bring your repositories' }).getAttribute('data-access')).toBe('done');
      expect(document.activeElement).toBe(playgroundRoot());
      expect(
        frameOf({ scene: chapterOf({ id: 'direction' }).beats[0]?.scene ?? '' }),
      ).toBeDefined();
    });

    it('flows from the last group into Get Goodboy', () => {
      seedProgress({ ids: ['bring', 'direction', 'guide'] });
      window.history.replaceState(null, '', '/?scene=demo#ship');
      render(<DemoPlayground />);
      const { hints, beats } = chapterOf({ id: 'ship' });
      for (const entry of hints) {
        const scene = beats[entry.beat]?.scene ?? '';
        const frame = frameOf({ scene });
        report({ frame, type: 'ready' });
        elapse({ ms: 320 });
        tried({ frame, hintId: entry.id });
        elapse({ ms: entry === hints.at(-1) ? 0 : dwellOf({ hint: entry }) });
      }
      expect(heading()).toBe('Review and ship');
      elapse({ ms: dwellOfLast({ id: 'ship' }) });
      expect(window.location.hash).toBe('#get');
      expect(heading()).toBe('Get Goodboy');
    });

    it('stays on the group when the visitor replays it from the rail during the dwell', () => {
      finishBring();
      fireEvent.click(rowOf({ title: 'Bring your repositories' }));
      expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
      elapse({ ms: dwellOfLast({ id: 'bring' }) * 2 });
      expect(heading()).toBe('Bring your repositories');
    });

    it('replays a finished group the rail jumps back to, and only that group', () => {
      seedProgress({ ids: ['bring', 'direction'] });
      window.history.replaceState(null, '', '/?scene=demo#guide');
      render(<DemoPlayground />);
      const before = visibleFrame();
      fireEvent.click(rowOf({ title: 'Bring your repositories' }));
      expect(window.location.hash).toBe('#bring');
      expect(heading()).toBe('Bring your repositories');
      expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
      expect(rowOf({ title: 'Set the direction' }).getAttribute('data-access')).toBe('done');
      expect(visibleFrame()).not.toBe(before);
      elapse({ ms: dwellOfLast({ id: 'bring' }) * 2 });
      expect(heading()).toBe('Bring your repositories');
      expect(document.activeElement).toBe(playgroundRoot());
    });

    it('opens the group where the story stands when a page load names a finished one', () => {
      seedProgress({ ids: ['bring', 'direction', 'guide'] });
      window.history.replaceState(null, '', '/?scene=demo#bring');
      const historyLength = window.history.length;
      render(<DemoPlayground />);
      expect(window.location.hash).toBe('#ship');
      expect(window.history.length).toBe(historyLength);
      expect(heading()).toBe('Review and ship');
      expect(rowOf({ title: 'Bring your repositories' }).getAttribute('data-access')).toBe('done');
    });

    it('opens Get Goodboy when a page load names a group and every group is done', () => {
      seedProgress({ ids: ['bring', 'direction', 'guide', 'ship'] });
      window.history.replaceState(null, '', '/?scene=demo#direction');
      render(<DemoPlayground />);
      expect(window.location.hash).toBe('#get');
      expect(heading()).toBe('Get Goodboy');
    });
  });

  it('brings a dismissed hint back on a blocked click and says why for 2.4 s', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const hintId = chapterOf({ id: 'bring' }).hints[0]?.id ?? '';
    hint({ frame, hintId });
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Dismiss hint' }));
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    blocked({ frame, hintId });
    expect(within(screen.getByRole('note')).getByText(WARNING).textContent).toBe(WARNING);
    elapse({ ms: 2399 });
    expect(screen.queryByText(WARNING)).not.toBeNull();
    elapse({ ms: 1 });
    expect(screen.queryByText(WARNING)).toBeNull();
    screen.getByTestId('demo-coach-mark');
  });

  it('does not replay an expired warning when a dismissed hint comes back', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const hintId = chapterOf({ id: 'bring' }).hints[0]?.id ?? '';
    hint({ frame, hintId });
    blocked({ frame, hintId });
    expect(screen.queryByText(WARNING)).not.toBeNull();
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Dismiss hint' }));
    elapse({ ms: 2400 });
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Show hint' }));
    screen.getByTestId('demo-coach-mark');
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('hands focus back to the playground after Show hint, Hide hints and Show hints', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: chapterOf({ id: 'bring' }).hints[0]?.id ?? '' });
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Dismiss hint' }));
    const showHint = within(topBar()).getByRole('button', { name: 'Show hint' });
    showHint.focus();
    fireEvent.click(showHint);
    expect(document.activeElement).toBe(playgroundRoot());
    const toggle = within(topBar()).getByRole('button', { name: 'Hide hints' });
    toggle.focus();
    fireEvent.click(toggle);
    expect(document.activeElement).toBe(playgroundRoot());
    within(topBar()).getByRole('button', { name: 'Show hints' }).focus();
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Show hints' }));
    expect(document.activeElement).toBe(playgroundRoot());
  });
});
