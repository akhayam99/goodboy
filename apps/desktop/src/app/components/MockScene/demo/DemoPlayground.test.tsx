// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_GROUPS } from './demoGroups';
import { DEMO_PROTOCOL, type DemoRect, type DemoReportType } from './director/demoProtocol';
import { HINT_PROGRESS_KEY } from './hints/hintProgressKey';
import { GROUP_VISITS_KEY } from './hints/groupVisitsKey';

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
  readonly isOffscreen?: boolean;
  readonly generation?: number;
  readonly source?: MessageEventSource | null;
};

const hint = ({
  frame,
  hintId,
  rect = { x: 900, y: 700, width: 28, height: 28 },
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

const currentStep = (): string =>
  document.querySelector('ol button[aria-current="step"]')?.textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
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
    const titles = Array.from(rail.querySelectorAll('button')).map(
      (row) => row.querySelector('.text-row')?.textContent,
    );
    expect(titles).toEqual(Object.values(DEMO_GROUPS).map((group) => group.title));
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
    expect(Array.from(rail.querySelectorAll('button')).map((row) => row.textContent)).toEqual([
      '01Set upOptional0 of 5 tried',
      '02Work with an agent0 of 4 tried',
      '03Orchestrate0 of 6 tried',
      '04Find work and results0 of 3 tried',
      '05Review and ship0 of 3 tried',
    ]);
  });

  it('opens the group named in the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orchestrate');
    expect(visibleFrame().getAttribute('src')).toContain('scene=c07-auto-start');
    expect(visibleFrame().getAttribute('src')).toContain('director=1');
  });

  it('moves to the next group and writes it to the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Orchestrate' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Replay group' }));
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

  it('jumps to a step from the timeline', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Run approval' }));
    expect(currentStep()).toBe('Run approval');
  });

  it('shows the download in the rail and again in the top bar only below the large breakpoint', async () => {
    const last = DEMO_CHAPTERS.at(-1);
    window.history.replaceState(null, '', `/?scene=demo#${last?.id ?? ''}`);
    render(<DemoPlayground />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    const downloads = screen.getAllByRole('link', { name: /Download for macOS/ });
    expect(downloads).toHaveLength(2);
    expect(downloads.filter((link) => link.className.includes('lg:hidden'))).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the start' }));
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
  });

  it('says the playground is mock data until every group is tried', () => {
    window.localStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: ['agent-send', 'agent-answer', 'agent-files'], skipped: [], epoch: 0 },
      }),
    );
    render(<DemoPlayground />);
    expect(screen.getByText(/Mock data only/).textContent).toBe(
      'Mock data only. Nothing leaves this page.',
    );
    expect(screen.queryByText(/You have tried every group/)).toBeNull();
  });

  it('closes the note on the download once every group is tried', () => {
    const progress = Object.fromEntries(
      DEMO_CHAPTERS.map((chapter) => [
        chapter.id,
        { tried: (chapter.hints ?? []).map((entry) => entry.id), skipped: [], epoch: 0 },
      ]),
    );
    window.localStorage.setItem(HINT_PROGRESS_KEY, JSON.stringify(progress));
    render(<DemoPlayground />);
    expect(screen.getByText(/every group/).textContent).toBe(
      'You have tried every group. Take Goodboy home.',
    );
  });

  it('remembers every group the visitor opened', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Orchestrate' }));
    expect(JSON.parse(window.localStorage.getItem(GROUP_VISITS_KEY) ?? '[]')).toEqual([
      'agent',
      'orchestrate',
    ]);
  });

  it('keeps the mock data line while one group is still untried', () => {
    const progress = Object.fromEntries(
      DEMO_CHAPTERS.filter((chapter) => chapter.id !== 'review').map((chapter) => [
        chapter.id,
        { tried: (chapter.hints ?? []).map((entry) => entry.id), skipped: [], epoch: 0 },
      ]),
    );
    window.localStorage.setItem(HINT_PROGRESS_KEY, JSON.stringify(progress));
    render(<DemoPlayground />);
    expect(screen.queryByText(/You have tried every group/)).toBeNull();
  });

  it('shows the loading state until the frame reports ready', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('status').textContent).toBe('Opening Goodboy');
    report({ frame: visibleFrame(), type: 'ready' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores a report from a window that is not one of its frames', () => {
    render(<DemoPlayground />);
    report({ frame: visibleFrame(), type: 'ready', source: window });
    expect(screen.getByRole('status').textContent).toBe('Opening Goodboy');
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
    fireEvent.click(screen.getByRole('button', { name: 'Replay group' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Welcome' }));
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
    const slot = screen.getByRole('note', { name: 'Hint' });
    expect(slot.textContent).toContain('Send this follow-up to the agent');
    fireEvent.click(screen.getByRole('button', { name: 'Show control' }));
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'reveal', hintId: 'agent-send', generation: 0 }),
      window.location.origin,
    );
    hint({ frame, hintId: 'agent-send' });
    expect(screen.queryByRole('note', { name: 'Hint' })).toBeNull();
    expect(screen.getByRole('note', { name: 'Step 1 of 4' })).not.toBeNull();
  });

  it('celebrates the end of setup and points to Work with an agent', () => {
    window.history.replaceState(null, '', '/?scene=demo#setup');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'setup-done' });
    const note = screen.getByRole('note', { name: 'Group done' });
    expect(note.textContent).toContain('Scout answered your first task');
    expect(screen.queryByRole('button', { name: 'Skip hint' })).toBeNull();
    fireEvent.click(within(note).getByRole('button', { name: /Next: Work with an agent/ }));
    expect(window.location.hash).toBe('#agent');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Work with an agent');
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
    const note = screen.getByRole('note', { name: 'Step 1 of 4' });
    expect(note.textContent).toContain('Send this follow-up to the agent');
    expect(screen.getByTestId('demo-coach-mark').contains(note)).toBe(true);
    fireEvent.click(within(note).getByRole('button', { name: 'Skip hint' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('tracks the hints again and drops a stale hint once the frame reloads', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    expect(screen.getByRole('note', { name: 'Step 1 of 4' })).not.toBeNull();
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

  it('hides the hint with Escape and brings it back with H', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByRole('button', { name: /Show hint/ })).not.toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'h' });
    expect(screen.getByRole('note', { name: 'Step 1 of 4' })).not.toBeNull();
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
    expect(JSON.parse(window.localStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: ['agent-answer'], skipped: [], epoch: 0 },
    });
  });

  it('follows another tab and never overwrites its progress', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    const otherTab = JSON.stringify({
      agent: { tried: ['agent-files'], skipped: [], epoch: 0 },
      setup: { tried: ['setup-start'], skipped: [], epoch: 0 },
    });
    window.localStorage.setItem(HINT_PROGRESS_KEY, otherTab);
    tried({ frame, hintId: 'agent-answer' });
    expect(JSON.parse(window.localStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: ['agent-files', 'agent-answer'], skipped: [], epoch: 0 },
      setup: { tried: ['setup-start'], skipped: [], epoch: 0 },
    });
    expect(screen.getAllByText(/2 of 4/)).toHaveLength(2);
    act(() => {
      window.localStorage.setItem(
        HINT_PROGRESS_KEY,
        JSON.stringify({ agent: { tried: [], skipped: [], epoch: 1 } }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: HINT_PROGRESS_KEY }));
    });
    expect(screen.getAllByText(/0 of 4/)).toHaveLength(2);
  });

  it('does not bring back a group another tab replayed', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    window.localStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({ agent: { tried: ['agent-answer'], skipped: [], epoch: 0 } }),
    );
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    window.localStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({ agent: { tried: [], skipped: [], epoch: 1 } }),
    );
    tried({ frame, hintId: 'agent-files' });
    expect(JSON.parse(window.localStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: [], skipped: [], epoch: 1 },
    });
    expect(screen.getAllByText(/0 of 4/)).toHaveLength(2);
  });

  it('starts with the stored progress and resets only this group on replay', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    window.localStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: ['agent-answer', 'agent-files'], skipped: [] },
        setup: { tried: ['setup-start'], skipped: [] },
      }),
    );
    render(<DemoPlayground />);
    expect(screen.getAllByText(/2 of 4/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Replay group' }));
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
});
