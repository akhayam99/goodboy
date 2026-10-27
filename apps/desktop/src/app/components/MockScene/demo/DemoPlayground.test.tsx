// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_GROUPS } from './demoGroups';
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

const tried = ({ frame, hintId }: TriedParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: 0,
          type: 'tried',
          hintId,
        },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );
  });
};

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

describe('demo playground', () => {
  it('keeps the rail on the same five groups as the phone page', () => {
    render(<DemoPlayground />);
    expect(DEMO_CHAPTERS.map((chapter) => chapter.id)).toEqual(Object.keys(DEMO_GROUPS));
    expect(groupRows().map((row) => row.querySelector('.truncate')?.textContent)).toEqual([
      ...Object.values(DEMO_GROUPS).map((group) => group.title),
      'Get Goodboy',
    ]);
  });

  it('loads no app frame while the stage has no room', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect());
    render(<DemoPlayground />);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('opens Set up on a fresh visit, with its steps listed and the other groups held back', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(visibleFrame().getAttribute('src')).toContain('scene=onboarding');
    expect(visibleFrame().getAttribute('src')).toContain('theme=dark');
    const steps = within(railOf()).getByRole('list', { name: 'Steps in this group' });
    expect(
      Array.from(steps.querySelectorAll('li')).map((step) => step.getAttribute('aria-label')),
    ).toEqual(
      chapterOf({ id: 'setup' }).hints.map(
        (entry, index) => `${entry.label}, ${index === 0 ? 'now' : 'next'}`,
      ),
    );
    expect(groupRows().map((row) => row.getAttribute('data-access'))).toEqual([
      'open',
      'open',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('opens the group named in the hash once it is reachable', () => {
    seedProgress({ ids: ['setup', 'agent'] });
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orchestrate');
    expect(visibleFrame().getAttribute('src')).toContain(
      `scene=${chapterOf({ id: 'orchestrate' }).beats[0]?.scene ?? ''}`,
    );
    expect(visibleFrame().getAttribute('src')).toContain('director=1');
  });

  it('falls back to Set up when the hash names a group that is still locked', () => {
    window.history.replaceState(null, '', '/?scene=demo#review');
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    window.history.replaceState(null, '', '/?scene=demo#get');
    cleanup();
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
  });

  it('shows every group title with its count kept quiet', () => {
    render(<DemoPlayground />);
    for (const group of Object.values(DEMO_GROUPS)) {
      expect(rowOf({ title: group.title }).textContent).toContain(group.title);
    }
    expect(rowOf({ title: DEMO_GROUPS.agent.title }).textContent).toContain(
      `0 of ${chapterOf({ id: 'agent' }).hints.length}`,
    );
  });

  it('moves to another group from its rail row and writes it to the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.click(rowOf({ title: 'Set up' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(window.location.hash).toBe('#setup');
  });

  it('moves between the groups it may open with the arrow keys', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowLeft' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[1]?.id ?? ''}`);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[1]?.id ?? ''}`);
  });

  it('replays the group in a fresh frame', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    expect(Array.from(document.querySelectorAll('iframe')).some((frame) => frame !== before)).toBe(
      true,
    );
  });

  it('has nothing to play or pause, and Space does nothing', () => {
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: ' ' });
    expect(screen.queryByRole('button', { name: /^(Play|Pause)$/ })).toBeNull();
  });

  it('shows the loading state until the frame reports ready', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('status').textContent).toBe('Loading Set up');
    report({ frame: visibleFrame(), type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores a report from a window that is not one of its frames', () => {
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready', source: window });
    expect(screen.getByRole('status').textContent).toBe('Loading Set up');
  });

  it('plays the cues once the frame is ready and never moves on by itself', () => {
    seedProgress({ ids: ['setup', 'agent', 'orchestrate'] });
    window.history.replaceState(null, '', '/?scene=demo#find');
    render(<DemoPlayground />);
    const board = visibleFrame();
    const post = vi.spyOn(board.contentWindow ?? window, 'postMessage');
    report({ frame: board, type: 'ready' });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'play', generation: 0 }),
      window.location.origin,
    );
    report({ frame: board, type: 'complete' });
    elapse({ ms: 60000 });
    expect(visibleFrame()).toBe(board);
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pause' }),
      window.location.origin,
    );
  });

  it('drops reports from the frame a replay left behind', () => {
    render(<DemoPlayground />);
    const first = visibleFrame();
    report({ frame: first, type: 'ready' });
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    report({ frame: first, type: 'complete' });
    expect(Array.from(document.querySelectorAll('iframe')).some((frame) => frame !== first)).toBe(
      true,
    );
  });

  it('switches the stage to the light theme and keeps the frame it shows', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    const src = before.getAttribute('src');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(visibleFrame()).toBe(before);
    expect(visibleFrame().getAttribute('src')).toBe(src);
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).not.toBeNull();
  });

  it('names the group track for the visible frame once it is ready', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hints', chapterId: 'agent', settledIds: [], generation: 0 }),
      window.location.origin,
    );
  });

  it('drops a hint from a stale generation, from another window or for an unknown step', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0]?.id ?? '';
    hint({ frame, hintId: first, generation: 3 });
    hint({ frame, hintId: first, source: window });
    hint({ frame, hintId: 'not-a-hint' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows the position once, on the rail, and not in the header or the coach', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const { hints } = chapterOf({ id: 'setup' });
    for (const [index, entry] of hints.entries()) {
      hint({ frame, hintId: entry.id });
      expect(screen.getByRole('note').textContent).not.toMatch(/\bstep \d+ of\b/i);
      expect(screen.queryByTestId('demo-counter')).toBeNull();
      expect(stepStates().filter((state) => state === 'done')).toHaveLength(index);
      expect(stepStates()[index]).toBe('current');
      tried({ frame, hintId: entry.id });
      elapse({ ms: RESULT_DWELL_MS });
    }
    expect(screen.queryByTestId('demo-counter')).toBeNull();
    expect(stepStates().every((state) => state === 'done')).toBe(true);
  });

  it('credits the steps strictly in order and ignores one that is not next', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const { hints } = chapterOf({ id: 'setup' });
    tried({ frame, hintId: hints[2]?.id ?? '' });
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
    tried({ frame, hintId: hints[0]?.id ?? '' });
    tried({ frame, hintId: hints[0]?.id ?? '' });
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(1);
    expect(JSON.parse(window.sessionStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      setup: { tried: [hints[0]?.id], epoch: 0 },
    });
  });

  it('credits two steps the frame finishes in the same tick, one after the other', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const { hints } = chapterOf({ id: 'setup' });
    act(() => {
      for (const entry of [hints[0], hints[1]]) {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              channel: DEMO_PROTOCOL.channel,
              version: DEMO_PROTOCOL.version,
              generation: 0,
              type: 'tried',
              hintId: entry?.id ?? '',
            },
            origin: window.location.origin,
            source: frame.contentWindow,
          }),
        );
      }
    });
    expect(JSON.parse(window.sessionStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      setup: { tried: [hints[0]?.id, hints[1]?.id], epoch: 0 },
    });
  });

  it('shows the instruction, then the result for the dwell, then the next instruction', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const { hints } = chapterOf({ id: 'setup' });
    const [first, second] = hints;
    expect(instruction()).toBe(first?.instruction);
    hint({ frame, hintId: first?.id ?? '' });
    expect(instruction()).toBe(first?.instruction);
    tried({ frame, hintId: first?.id ?? '' });
    expect(instruction()).toBe(first?.result);
    elapse({ ms: RESULT_DWELL_MS - 100 });
    expect(instruction()).toBe(first?.result);
    hint({ frame, hintId: null, rect: null });
    elapse({ ms: 200 });
    expect(instruction()).toBe(first?.result);
    hint({ frame, hintId: second?.id ?? '' });
    expect(instruction()).toBe(second?.instruction);
  });

  it('says the group is done only after the last result has been on screen', () => {
    seedProgress({ ids: ['setup'] });
    const { hints } = chapterOf({ id: 'agent' });
    window.sessionStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        setup: { tried: idsOf({ id: 'setup' }), epoch: 0 },
        agent: { tried: hints.slice(0, -1).map((entry) => entry.id), epoch: 0 },
      }),
    );
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const last = hints.at(-1);
    hint({ frame, hintId: last?.id ?? '' });
    tried({ frame, hintId: last?.id ?? '' });
    expect(instruction()).toBe(last?.result);
    expect(instruction()).not.toContain('is done');
    elapse({ ms: RESULT_DWELL_MS });
    expect(instruction()).toContain('Work with an agent is done');
    expect(instruction()).toContain('Orchestrate');
  });

  it('changes the scene only when a step that lives in another scene becomes the next one', () => {
    seedProgress({ ids: ['setup', 'agent', 'orchestrate'] });
    window.history.replaceState(null, '', '/?scene=demo#find');
    render(<DemoPlayground />);
    const { hints, beats } = chapterOf({ id: 'find' });
    const crossing = hints.findIndex(
      (entry, index) => index > 0 && entry.beat !== (hints[index - 1]?.beat ?? 0),
    );
    expect(crossing).toBeGreaterThan(0);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    for (const entry of hints.slice(0, crossing - 1)) {
      tried({ frame, hintId: entry.id });
      elapse({ ms: dwellOf({ hint: entry }) });
    }
    const before = visibleFrame();
    expect(before.getAttribute('src')).toContain(
      `scene=${beats[hints[crossing - 1]?.beat ?? 0]?.scene ?? ''}`,
    );
    tried({ frame: before, hintId: hints[crossing - 1]?.id ?? '' });
    expect(visibleFrame()).toBe(before);
    const crossed = hints[crossing - 1];
    if (crossed === undefined) {
      throw new Error('no crossing hint');
    }
    elapse({ ms: dwellOf({ hint: crossed }) });
    const next = frameOf({ scene: beats[hints[crossing]?.beat ?? 0]?.scene ?? '' });
    report({ frame: next, type: 'ready' });
    expect(visibleFrame()).toBe(next);
  });

  it('keeps the result line until the next control is on screen', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const [first, second] = chapterOf({ id: 'setup' }).hints;
    hint({ frame, hintId: first?.id ?? '' });
    tried({ frame, hintId: first?.id ?? '' });
    hint({ frame, hintId: null, rect: null });
    elapse({ ms: RESULT_DWELL_MS + 5000 });
    expect(instruction()).toBe(first?.result);
    hint({ frame, hintId: second?.id ?? '' });
    expect(instruction()).toBe(second?.instruction);
  });

  it('never moves focus when a hint opens or hides', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const before = document.activeElement;
    hint({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    expect(document.activeElement).toBe(before);
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(document.activeElement).toBe(before);
  });

  it('shows no hint and no spotlight while the frame holds the next one back', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0]?.id ?? '';
    hint({ frame, hintId: first });
    expect(screen.queryByTestId('demo-spotlight')).not.toBeNull();
    hint({ frame, hintId: null, rect: null });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
  });

  it('shows no hint for a step that is not the next one', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: chapterOf({ id: 'setup' }).hints[3]?.id ?? '' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('offers Show control for a hint whose control is scrolled away, without a way to skip it', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0];
    hint({ frame, hintId: first?.id ?? '', rect: null, isOffscreen: true });
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    const slot = screen.getByRole('note', { name: 'Hint' });
    expect(slot.textContent).toContain(first?.copy ?? '');
    expect(screen.queryByRole('button', { name: 'Skip hint' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show control' }));
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'reveal', hintId: first?.id, generation: 0 }),
      window.location.origin,
    );
  });

  it('draws the hint over the stage beside its anchor, without a step count', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0];
    hint({ frame, hintId: first?.id ?? '' });
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(first?.copy ?? '');
    expect(screen.getByTestId('demo-coach-mark').contains(note)).toBe(true);
    expect(within(note).queryByRole('button', { name: 'Skip hint' })).toBeNull();
  });

  it('keeps the coach when the visitor clicks a control that opens nothing new, as the composer', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0]?.id ?? '';
    hint({ frame, hintId: first, isClicked: true });
    expect(screen.queryByRole('note')).not.toBeNull();
  });

  it('lifts the coach once the visitor presses the control, so it never covers what opens', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0]?.id ?? '';
    hint({ frame, hintId: first });
    expect(screen.queryByRole('note')).not.toBeNull();
    hint({ frame, hintId: first, isClicked: true, isPressed: true });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    expect(instruction()).toBe(chapterOf({ id: 'setup' }).hints[0]?.instruction);
  });

  it('dims the app around the hinted control and lets the control and its note stay sharp', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    hint({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    const spotlight = screen.getByTestId('demo-spotlight');
    expect(spotlight.getAttribute('aria-hidden')).toBe('true');
    expect(spotlight.children).toHaveLength(0);
    expect(spotlight.contains(screen.getByRole('note'))).toBe(false);
    expect(screen.getByTestId('demo-coach-mark').contains(spotlight)).toBe(true);
  });

  it('does not dim the stage when the hole would cover most of it', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({
      frame,
      hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '',
      focus: { x: 0, y: 0, width: 1400, height: 880 },
    });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    expect(screen.queryByRole('note')).not.toBeNull();
  });

  it('quiets only the secondary chrome while the spotlight is on', () => {
    const agentHints = chapterOf({ id: 'agent' }).hints;
    window.sessionStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        setup: { tried: idsOf({ id: 'setup' }), epoch: 0 },
        agent: { tried: [agentHints[0]?.id], epoch: 0 },
      }),
    );
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const title = screen.getByRole('heading', { level: 1 });
    const back = screen.getAllByRole('link', { name: /goodboy-ai.dev/ });
    hint({ frame, hintId: agentHints[1]?.id ?? '' });
    expect(rowOf({ title: 'Set up' }).closest('[data-quiet]')?.getAttribute('data-quiet')).toBe(
      'true',
    );
    expect(back.some((link) => link.closest('[data-quiet="true"]') !== null)).toBe(true);
    for (const element of [
      title,
      screen.getByTestId('demo-instruction'),
      screen.getByRole('note'),
    ]) {
      expect(element.closest('[data-quiet="true"]')).toBeNull();
    }
    expect(
      rowOf({ title: 'Work with an agent' }).closest('[data-quiet]')?.getAttribute('data-quiet'),
    ).toBe('false');
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(document.querySelector('[data-quiet="true"]')).toBeNull();
  });

  it('tracks the hints again and drops a stale hint once the frame reloads', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    hint({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    expect(screen.queryByRole('note')).not.toBeNull();
    report({ frame, type: 'ready' });
    expect(screen.queryByRole('note')).toBeNull();
    const tracks = post.mock.calls.filter(
      ([message]) => typeof message === 'object' && message !== null && message.type === 'hints',
    );
    expect(tracks).toHaveLength(2);
  });

  it('plays a reloaded frame again', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    report({ frame, type: 'ready' });
    const plays = post.mock.calls.filter(
      ([message]) => typeof message === 'object' && message !== null && message.type === 'play',
    );
    expect(plays).toHaveLength(2);
  });

  it('dismisses only the open hint with Escape, leaves the hints on and brings it back with H', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show hints' })).toBeNull();
    within(topBar()).getByRole('button', { name: 'Hide hints' });
    expect(instruction()).toBe(chapterOf({ id: 'setup' }).hints[0]?.instruction);
    fireEvent.keyDown(playgroundRoot(), { key: 'h' });
    expect(screen.queryByRole('note')).not.toBeNull();
  });

  it('dismisses only the open hint with the coach X and shows the next one', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const [first, second] = chapterOf({ id: 'setup' }).hints;
    hint({ frame, hintId: first?.id ?? '' });
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Dismiss hint' }));
    expect(screen.queryByRole('note')).toBeNull();
    within(topBar()).getByRole('button', { name: 'Hide hints' });
    expect(screen.queryByRole('button', { name: 'Show hints' })).toBeNull();
    tried({ frame, hintId: first?.id ?? '' });
    elapse({ ms: RESULT_DWELL_MS });
    hint({ frame, hintId: second?.id ?? '' });
    expect(screen.getByRole('note').textContent).toContain(second?.copy ?? '');
  });

  it('turns the hints off and back on from the wrapper and keeps that in the tab', () => {
    const view = render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const first = chapterOf({ id: 'setup' }).hints[0]?.id ?? '';
    hint({ frame, hintId: first });
    screen.getByRole('note');
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Hide hints' }));
    expect(screen.queryByRole('note')).toBeNull();
    view.unmount();
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    hint({ frame: visibleFrame(), hintId: first });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show hints' }));
    screen.getByRole('note');
  });

  it('keeps progress in the tab and never in the shared storage', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    expect(window.sessionStorage.getItem(HINT_PROGRESS_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(HINT_PROGRESS_KEY)).toBeNull();
  });

  it('starts a new tab with nothing done', () => {
    const view = render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(1);
    view.unmount();
    window.sessionStorage.clear();
    render(<DemoPlayground />);
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: chapterOf({ id: 'setup' }).hints[0]?.id ?? '' });
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(1);
  });

  it('starts with the stored progress and resets only this group on replay', () => {
    window.sessionStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: idsOf({ id: 'agent' }).slice(0, 2), epoch: 0 },
        setup: { tried: idsOf({ id: 'setup' }).slice(0, 1), epoch: 0 },
      }),
    );
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(2);
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
    expect(rowOf({ title: 'Set up' }).textContent).toContain(
      `1 of ${chapterOf({ id: 'setup' }).hints.length}`,
    );
  });

  it('restarts at the first step of Set up and clears every group', () => {
    seedProgress({ ids: ['setup', 'agent'] });
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(window.location.hash).toBe('#setup');
    expect(stepStates()[0]).toBe('current');
    expect(stepStates().filter((state) => state === 'done')).toHaveLength(0);
    expect(rowOf({ title: 'Orchestrate' }).getAttribute('data-access')).toBe('locked');
    expect(rowOf({ title: 'Work with an agent' }).textContent).toContain(
      `0 of ${chapterOf({ id: 'agent' }).hints.length}`,
    );
  });

  it('restarts Set up in a fresh frame when it is already open', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(Array.from(document.querySelectorAll('iframe')).some((frame) => frame !== before)).toBe(
      true,
    );
  });
});
