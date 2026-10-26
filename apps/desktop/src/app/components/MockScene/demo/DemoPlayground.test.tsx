// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_GROUPS } from './demoGroups';
import { DEMO_PROTOCOL, type DemoRect, type DemoReportType } from './director/demoProtocol';
import { HINT_PROGRESS_KEY } from './hints/hintProgressKey';

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
  readonly generation?: number;
  readonly source?: MessageEventSource | null;
};

const hint = ({
  frame,
  hintId,
  rect = { x: 900, y: 700, width: 28, height: 28 },
  focus = null,
  isOffscreen = false,
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

type PlaceParams = {
  readonly frame: HTMLIFrameElement;
  readonly place: string;
};

const place = ({ frame, place: where }: PlaceParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: 0,
          type: 'place',
          place: where,
        },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );
  });
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

const currentStep = (): string =>
  document.querySelector('ol button[aria-current="step"]')?.textContent ?? '';

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
    const rail = screen.getByRole('navigation', { name: 'Playground groups' });
    const titles = Array.from(rail.querySelectorAll('button[data-up-next]')).map(
      (row) => row.querySelector('.text-row')?.textContent,
    );
    expect(titles).toEqual([
      ...Object.values(DEMO_GROUPS).map((group) => group.title),
      'Get Goodboy',
    ]);
    expect(DEMO_CHAPTERS.map((chapter) => chapter.id)).toEqual(Object.keys(DEMO_GROUPS));
  });

  it('loads no app frame while the stage has no room', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect());
    render(<DemoPlayground />);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('opens Set up on a fresh visit and lists the five groups', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(visibleFrame().getAttribute('src')).toContain('scene=onboarding');
    expect(visibleFrame().getAttribute('src')).toContain('theme=dark');
    const rail = screen.getByRole('navigation', { name: 'Playground groups' });
    expect(
      Array.from(rail.querySelectorAll('button[data-up-next]')).map((row) => row.textContent),
    ).toEqual([
      '01Set upOptional0 of 5 tried',
      '02Work with an agentUp next0 of 4 tried',
      '03Orchestrate0 of 6 tried',
      '04Find work and results0 of 3 tried',
      '05Review and ship0 of 3 tried',
      'Get Goodboy',
    ]);
  });

  it('opens the group named in the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orchestrate');
    expect(visibleFrame().getAttribute('src')).toContain('scene=c07-auto-start');
    expect(visibleFrame().getAttribute('src')).toContain('director=1');
  });

  it('moves to another group from its rail row and writes it to the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: /^\d+\s*Orchestrate/ }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orchestrate');
    expect(window.location.hash).toBe('#orchestrate');
  });

  it('moves between groups with the arrow keys', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowLeft' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[1]?.id ?? ''}`);
  });

  it('replays the group in a fresh frame', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    const frames = document.querySelectorAll('iframe');
    expect(Array.from(frames).some((frame) => frame !== before)).toBe(true);
  });

  it('has nothing to play or pause, and Space does nothing', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: ' ' });
    expect(screen.queryByRole('button', { name: /^(Play|Pause)$/ })).toBeNull();
    expect(currentStep()).toBe('Auto starts');
  });

  it('jumps to a step from the rail', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    fireEvent.click(within(railOf()).getByRole('button', { name: 'Run approval' }));
    expect(currentStep()).toBe('Run approval');
  });

  it('puts Get Goodboy up next after the last group and nothing up next after it', () => {
    const last = DEMO_CHAPTERS.at(-1);
    window.history.replaceState(null, '', `/?scene=demo#${last?.id ?? ''}`);
    render(<DemoPlayground />);
    const next = document.querySelector('nav [data-up-next="soon"]');
    expect(next?.textContent).toContain('Get Goodboy');
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe('#get');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Get Goodboy');
    expect(document.querySelector('[data-up-next]:not([data-up-next="none"])')).toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe('#get');
  });

  it('shows the loading state until the frame reports ready', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('status').textContent).toBe('Loading Set up');
    report({ frame: visibleFrame(), type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('selects the group row and shows the loading state at once when the next frame is not ready', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
    const row = screen.getByRole('button', { name: /Find work and results/ });
    fireEvent.click(row);
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('status').textContent).toBe('Loading Find work and results');
    const next = document.querySelector<HTMLIFrameElement>('iframe[data-shown="false"]');
    if (next === null) {
      throw new Error('no frame loading');
    }
    report({ frame: next, type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(visibleFrame()).toBe(next);
  });

  it('names the beat being loaded when the visitor steps to another beat', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Steps in this group' })).getByText('Limits'),
    );
    expect(screen.getByRole('status').textContent).toBe('Loading Limits');
  });

  it('loads the frame of a group while the pointer is on its row', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    const sources = (): ReadonlyArray<string> =>
      Array.from(document.querySelectorAll('iframe')).map((entry) => entry.src);
    const before = sources();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Review and ship/ }));
    const after = sources();
    expect(after).toHaveLength(before.length);
    expect(after.some((src) => !before.includes(src))).toBe(true);
  });

  it('never moves focus when a hint opens, hides or lifts', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const before = document.activeElement;
    hint({ frame, hintId: 'agent-send' });
    expect(document.activeElement).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Skip hint' }));
    hint({ frame, hintId: 'agent-answer' });
    expect(document.activeElement).toBe(before);
  });

  it('shows no hint and no spotlight while the frame holds the next one back', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-limits-peek' });
    expect(screen.queryByTestId('demo-spotlight')).not.toBeNull();
    hint({ frame, hintId: null, rect: null });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
  });

  it('ignores a report from a window that is not one of its frames', () => {
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready', source: window });
    expect(screen.getByRole('status').textContent).toBe('Loading Set up');
  });

  it('plays the cues once the frame is ready and never moves on by itself', () => {
    window.history.replaceState(null, '', '/?scene=demo#find');
    render(<DemoPlayground />);
    const board = frameOf({ scene: 'board-shell' });
    const post = vi.spyOn(board.contentWindow ?? window, 'postMessage');
    report({ frame: board, type: 'ready' });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'play', generation: 0 }),
      window.location.origin,
    );
    report({ frame: board, type: 'complete' });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(currentStep()).toBe('Board');
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pause' }),
      window.location.origin,
    );
  });

  it('drops reports from the frame a replay left behind', () => {
    window.history.replaceState(null, '', '/?scene=demo#find');
    render(<DemoPlayground />);
    const board = frameOf({ scene: 'board-shell' });
    report({ frame: board, type: 'ready' });
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    report({ frame: board, type: 'complete' });
    const fresh = Array.from(document.querySelectorAll('iframe')).find(
      (entry) => entry !== board && (entry.getAttribute('src') ?? '').includes('board-shell'),
    );
    expect(fresh).not.toBeUndefined();
    expect(currentStep()).toBe('Board');
  });

  it('follows the wizard screen the visitor walks to, and reloads a step picked again', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const wizard = visibleFrame();
    report({ frame: wizard, type: 'ready' });
    place({ frame: wizard, place: 'tools' });
    expect(currentStep()).toBe('Tools');
    expect(visibleFrame()).toBe(wizard);
    place({ frame: wizard, place: 'not-a-step' });
    expect(currentStep()).toBe('Tools');
    fireEvent.click(within(railOf()).getByRole('button', { name: 'Welcome' }));
    expect(currentStep()).toBe('Welcome');
    const welcome = Array.from(document.querySelectorAll('iframe')).filter((entry) =>
      (entry.getAttribute('src') ?? '').includes('step=welcome'),
    );
    expect(welcome.some((entry) => entry !== wizard)).toBe(true);
  });

  it('offers Show control for a hint whose control is scrolled away', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', rect: null, isOffscreen: true });
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    const slot = screen.getByRole('note', { name: 'Hint' });
    expect(slot.textContent).toContain('Send the follow-up');
    fireEvent.click(screen.getByRole('button', { name: 'Show control' }));
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'reveal', hintId: 'agent-send', generation: 0 }),
      window.location.origin,
    );
    hint({ frame, hintId: 'agent-send' });
    expect(screen.queryByRole('note', { name: 'Hint' })).toBeNull();
    expect(screen.getByRole('note', { name: 'Step 1 of 6' })).not.toBeNull();
  });

  it('lets the visitor skip a hint whose control is scrolled away', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', rect: null, isOffscreen: true });
    fireEvent.click(
      within(screen.getByRole('note', { name: 'Hint' })).getByRole('button', { name: 'Skip hint' }),
    );
    expect(screen.queryByRole('note', { name: 'Hint' })).toBeNull();
  });

  const finishSetup = ({ frame }: { readonly frame: HTMLIFrameElement }) => {
    for (const hintId of [
      'setup-start',
      'setup-agents',
      'setup-create',
      'setup-tools',
      'setup-first-start',
    ]) {
      tried({ frame, hintId });
    }
  };

  const upNextRow = () => screen.getByRole('button', { name: /^02/ });

  it('closes a finished group with no card: Up next pulses, then rests, and a click goes there', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    expect(upNextRow().getAttribute('data-up-next')).toBe('soon');
    expect(upNextRow().getAttribute('data-pulsing')).toBe('false');
    finishSetup({ frame });
    expect(upNextRow().getAttribute('data-up-next')).toBe('ready');
    expect(upNextRow().getAttribute('data-pulsing')).toBe('true');
    expect(screen.queryByRole('note', { name: 'Group done' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Go to/ })).toBeNull();
    expect(screen.queryByTestId('demo-coach-mark')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(upNextRow().getAttribute('data-up-next')).toBe('ready');
    expect(upNextRow().getAttribute('data-pulsing')).toBe('false');
    fireEvent.click(upNextRow());
    expect(window.location.hash).toBe('#agent');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Work with an agent');
  });

  it('offers a Next group control in the timeline that pulses once the group is done and goes there', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const nextControl = () => screen.getByRole('button', { name: 'Next group' });
    const marker = () => nextControl().closest('[data-up-next]');
    expect(marker()?.getAttribute('data-up-next')).toBe('soon');
    expect(marker()?.getAttribute('data-pulsing')).toBe('false');
    finishSetup({ frame });
    expect(marker()?.getAttribute('data-up-next')).toBe('ready');
    expect(marker()?.getAttribute('data-pulsing')).toBe('true');
    fireEvent.click(nextControl());
    expect(window.location.hash).toBe('#agent');
  });

  it('never points the finished-group line at the left, where a narrow window has no rail', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    finishSetup({ frame });
    const line = screen.getByRole('heading', { level: 1 }).closest('header')?.querySelector('p');
    expect(line?.textContent).not.toMatch(/left/i);
  });

  it('writes the live instruction under the title from the hint, the beat and the done state', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const instruction = () =>
      screen.getByRole('heading', { level: 1 }).closest('header')?.querySelector('p')?.textContent;
    expect(instruction()).toBe(DEMO_CHAPTERS[0]?.beats[0]?.shows);
    hint({ frame, hintId: 'setup-start' });
    expect(instruction()).toBe(DEMO_CHAPTERS[0]?.hints?.[0]?.instruction);
    expect(instruction()).toBe('Click Get started to see which agents Goodboy found on your Mac.');
    expect(screen.getByRole('note', { name: 'Step 1 of 6' }).textContent).not.toContain(
      instruction() ?? '',
    );
    hint({ frame, hintId: 'setup-agents' });
    expect(instruction()).toBe(DEMO_CHAPTERS[0]?.hints?.[1]?.instruction);
    hint({ frame, hintId: null, rect: null });
    expect(instruction()).toBe(DEMO_CHAPTERS[0]?.beats[0]?.shows);
    finishSetup({ frame });
    expect(instruction()).toContain('Set up is done');
    expect(instruction()).toContain('Work with an agent');
  });

  it('gives every hint a header instruction that never repeats its coach mark', () => {
    for (const chapter of DEMO_CHAPTERS) {
      for (const entry of chapter.hints ?? []) {
        expect(entry.instruction.length).toBeGreaterThan(0);
        expect(entry.instruction).not.toBe(entry.copy);
        expect(entry.instruction).not.toContain(entry.copy);
      }
    }
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

  it('draws the hint over the stage beside its anchor with a callout that takes clicks', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    const note = screen.getByRole('note', { name: 'Step 1 of 6' });
    expect(note.textContent).toContain('Send the follow-up');
    expect(screen.getByTestId('demo-coach-mark').contains(note)).toBe(true);
    fireEvent.click(within(note).getByRole('button', { name: 'Skip hint' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('dims the app around the hinted control and lets the control and its note stay sharp', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    hint({ frame, hintId: 'agent-send' });
    const spotlight = screen.getByTestId('demo-spotlight');
    expect(spotlight.getAttribute('aria-hidden')).toBe('true');
    expect(spotlight.children).toHaveLength(0);
    expect(spotlight.querySelector('button, a, [tabindex]')).toBeNull();
    expect(spotlight.contains(screen.getByRole('note'))).toBe(false);
    expect(screen.getByTestId('demo-coach-mark').contains(spotlight)).toBe(true);
  });

  type Box = {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };

  const holeBox = (): Box => {
    const [x = 0, y = 0, width = 0, height = 0] = (
      screen.getByTestId('demo-spotlight').getAttribute('data-hole') ?? ''
    )
      .split(' ')
      .map(Number);
    return { left: x, top: y, right: x + width, bottom: y + height };
  };

  const ringBox = (): Box => {
    const ring = screen.getByTestId('demo-coach-mark').querySelector<HTMLElement>('.ring-2');
    const left = parseFloat(ring?.style.left ?? '0');
    const top = parseFloat(ring?.style.top ?? '0');
    return {
      left,
      top,
      right: left + parseFloat(ring?.style.width ?? '0'),
      bottom: top + parseFloat(ring?.style.height ?? '0'),
    };
  };

  it('cuts the hole around the focus region as well as the control, with a little room', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    const alone = holeBox();
    const ring = ringBox();
    expect(alone.left).toBeLessThan(ring.left);
    expect(alone.top).toBeLessThan(ring.top);
    expect(alone.right).toBeGreaterThanOrEqual(ring.right);
    expect(alone.bottom).toBeGreaterThanOrEqual(ring.bottom);
    const focus = { x: 400, y: 600, width: 540, height: 200 };
    hint({ frame, hintId: 'agent-send', focus });
    const wide = holeBox();
    const scale = (ring.right - ring.left - 8) / 28;
    expect(wide.left).toBeLessThan(focus.x * scale);
    expect(wide.top).toBeLessThan(focus.y * scale);
    expect(wide.right).toBeGreaterThan((focus.x + focus.width) * scale);
    expect(wide.bottom).toBeGreaterThan((focus.y + focus.height) * scale);
    expect(wide.right - wide.left).toBeGreaterThan(alone.right - alone.left);
  });

  it('falls back to the control alone when the frame reports no region', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', focus: null });
    const hole = holeBox();
    const ring = ringBox();
    expect(hole.right - hole.left).toBeLessThan(ring.right - ring.left + 16);
    expect(hole.bottom - hole.top).toBeLessThan(ring.bottom - ring.top + 16);
  });

  it('keeps the hole inside the stage when the region reaches past it', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', focus: { x: -200, y: -200, width: 900, height: 700 } });
    const hole = holeBox();
    expect(hole.left).toBe(0);
    expect(hole.top).toBe(0);
  });

  it('does not dim the stage when the hole would cover most of it', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', focus: { x: 0, y: 0, width: 1400, height: 880 } });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    expect(screen.getByRole('note', { name: 'Step 1 of 6' })).not.toBeNull();
  });

  it('removes the spotlight once the control is clicked, hidden, skipped or done', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    expect(screen.queryByTestId('demo-spotlight')).not.toBeNull();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            channel: DEMO_PROTOCOL.channel,
            version: DEMO_PROTOCOL.version,
            generation: 0,
            type: 'anchor',
            hintId: 'agent-send',
            rect: { x: 900, y: 700, width: 28, height: 28 },
            isOffscreen: false,
            isClicked: true,
          },
          origin: window.location.origin,
          source: frame.contentWindow,
        }),
      );
    });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    expect(screen.queryByRole('note')).not.toBeNull();
    hint({ frame, hintId: 'agent-send' });
    expect(screen.queryByTestId('demo-spotlight')).not.toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'h' });
    expect(screen.queryByTestId('demo-spotlight')).not.toBeNull();
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Skip hint' }));
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
    hint({ frame, hintId: 'agent-answer' });
    tried({ frame, hintId: 'agent-answer' });
    hint({ frame, hintId: null, rect: null });
    expect(screen.queryByTestId('demo-spotlight')).toBeNull();
  });

  it('quiets only the secondary chrome while the spotlight is on and keeps what must be read at full strength', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const rowOf = ({ title }: { readonly title: string }): HTMLElement => {
      const row = within(screen.getByRole('navigation', { name: 'Playground groups' }))
        .getByText(title)
        .closest('div');
      if (row === null) {
        throw new Error(`no row for ${title}`);
      }
      return row;
    };
    const title = screen.getByRole('heading', { level: 1 });
    const summary = screen.getByText(DEMO_CHAPTERS[1]?.beats[0]?.shows ?? '');
    const counter = within(title.closest('header') ?? document.body).getByText(/0 of 4/);
    const back = screen.getAllByRole('link', { name: /goodboy-ai.dev/ });
    hint({ frame, hintId: 'agent-send' });
    expect(rowOf({ title: DEMO_GROUPS.setup.title }).getAttribute('data-quiet')).toBe('true');
    expect(back.some((link) => link.closest('[data-quiet="true"]') !== null)).toBe(true);
    const full = [
      title,
      summary,
      counter,
      screen.getByRole('note', { name: 'Step 1 of 6' }),
      rowOf({ title: DEMO_GROUPS.agent.title }),
    ];
    for (const element of full) {
      expect(element.closest('[data-quiet="true"]')).toBeNull();
    }
    const upNext = document.querySelector('[data-up-next="soon"]');
    expect(upNext?.parentElement?.getAttribute('data-quiet')).toBe('false');
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(document.querySelector('[data-quiet="true"]')).toBeNull();
  });

  it('tracks the hints again and drops a stale hint once the frame reloads', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    expect(screen.getByRole('note', { name: 'Step 1 of 6' })).not.toBeNull();
    report({ frame, type: 'ready' });
    expect(screen.queryByRole('note')).toBeNull();
    const tracks = post.mock.calls.filter(
      ([message]) => typeof message === 'object' && message !== null && message.type === 'hints',
    );
    expect(tracks).toHaveLength(2);
  });

  it('plays a reloaded frame again', () => {
    window.history.replaceState(null, '', '/?scene=demo#find');
    render(<DemoPlayground />);
    const board = frameOf({ scene: 'board-shell' });
    const post = vi.spyOn(board.contentWindow ?? window, 'postMessage');
    report({ frame: board, type: 'ready' });
    report({ frame: board, type: 'ready' });
    const plays = post.mock.calls.filter(
      ([message]) => typeof message === 'object' && message !== null && message.type === 'play',
    );
    expect(plays).toHaveLength(2);
  });

  it('drops a hint from a stale generation or from a window that is not the visible frame', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send', generation: 3 });
    hint({ frame, hintId: 'agent-send', source: window });
    hint({ frame, hintId: 'not-a-hint' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('hides the hints with Escape and brings them back with H', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show hints' })).not.toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'h' });
    expect(screen.getByRole('note', { name: 'Step 1 of 6' })).not.toBeNull();
  });

  it('skips a hint, tells the frame and keeps that across a reload', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    const view = render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip hint' }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'hints', settledIds: ['agent-send'] }),
      window.location.origin,
    );
    view.unmount();
    render(<DemoPlayground />);
    const again = visibleFrame();
    const repost = vi.spyOn(again.contentWindow ?? window, 'postMessage');
    report({ frame: again, type: 'ready' });
    expect(repost).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hints', settledIds: ['agent-send'] }),
      window.location.origin,
    );
  });

  it('counts tried outcomes in the rail and the header and keeps them in storage', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: 'agent-answer' });
    tried({ frame, hintId: 'agent-answer' });
    expect(screen.getAllByText(/1 of 4/)).toHaveLength(2);
    expect(JSON.parse(window.sessionStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: ['agent-answer'], skipped: [], epoch: 0 },
    });
  });

  it('starts with the stored progress and resets only this group on replay', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    window.sessionStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: ['agent-answer', 'agent-files'], skipped: [] },
        setup: { tried: ['setup-start'], skipped: [] },
      }),
    );
    render(<DemoPlayground />);
    expect(screen.getAllByText(/2 of 4/)).toHaveLength(2);
    fireEvent.keyDown(playgroundRoot(), { key: 'r' });
    expect(screen.getAllByText(/0 of 4/)).toHaveLength(2);
    expect(screen.getByText('1 of 5 tried').textContent).toBe('1 of 5 tried');
  });

  it('works without storage', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: 'agent-answer' });
    expect(screen.getAllByText(/1 of 4/)).toHaveLength(2);
  });

  it('keeps progress in the tab and never in the shared storage', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: 'agent-answer' });
    expect(window.sessionStorage.getItem(HINT_PROGRESS_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(HINT_PROGRESS_KEY)).toBeNull();
  });

  it('starts a new tab with nothing tried', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    const view = render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: 'agent-answer' });
    expect(screen.getAllByText(/1 of 4/)).toHaveLength(2);
    view.unmount();
    window.sessionStorage.clear();
    render(<DemoPlayground />);
    expect(screen.getAllByText(/0 of 4/)).toHaveLength(2);
  });

  it('restarts at the first step of Set up and clears every group', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    window.sessionStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: ['agent-answer'], skipped: [], epoch: 0 },
        setup: { tried: ['setup-start'], skipped: [], epoch: 0 },
      }),
    );
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(window.location.hash).toBe('#setup');
    expect(currentStep()).toBe('Welcome');
    expect(screen.getAllByText(/0 of 5/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/1 of 4/)).toBeNull();
  });

  it('restarts Set up in a fresh frame when it is already open', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(Array.from(document.querySelectorAll('iframe')).some((frame) => frame !== before)).toBe(
      true,
    );
  });

  it('turns the hints off and back on from the wrapper and keeps that in the tab', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    const view = render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    expect(screen.getByRole('note')).not.toBeNull();
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Hide hints' }));
    expect(screen.queryByRole('note')).toBeNull();
    view.unmount();
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready' });
    hint({ frame: visibleFrame(), hintId: 'agent-send' });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show hints' }));
    expect(screen.getByRole('note', { name: 'Step 1 of 6' })).not.toBeNull();
  });

  it('brings back the hints a visitor skipped when hints are shown again', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip hint' }));
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Hide hints' }));
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Show hints' }));
    expect(JSON.parse(window.sessionStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: [], skipped: [], epoch: 0 },
    });
  });
});
