// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
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
  readonly generation?: number;
  readonly source?: MessageEventSource | null;
};

const hint = ({
  frame,
  hintId,
  rect = { x: 900, y: 700, width: 28, height: 28 },
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
  it('loads no app frame while the stage has no room', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect());
    render(<DemoPlayground />);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('opens Work with an agent on a fresh visit and lists the five groups', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Work with an agent');
    expect(visibleFrame().getAttribute('src')).toContain('scene=chat-shell');
    expect(visibleFrame().getAttribute('src')).toContain('theme=dark');
    const rail = screen.getByRole('navigation', { name: 'Playground groups' });
    expect(Array.from(rail.querySelectorAll('button')).map((row) => row.textContent)).toEqual([
      '01Set upOptional0 of 5 tried',
      '02Work with an agent0 of 3 tried',
      '03Orchestrate',
      '04Find work and results',
      '05Review and ship',
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
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Orchestrate' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orchestrate');
    expect(window.location.hash).toBe('#orchestrate');
  });

  it('moves between groups with the arrow keys', () => {
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowLeft' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowRight' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[1]?.id ?? ''}`);
  });

  it('remounts the stage frame on replay', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Replay chapter' }));
    const frames = document.querySelectorAll('iframe');
    expect(Array.from(frames).some((frame) => frame !== before)).toBe(true);
  });

  it('jumps to a step from the timeline and pauses autoplay', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Run approval' }));
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-label')).toBe('Play');
    expect(currentStep()).toBe('Run approval');
  });

  it('offers the download at the end of the tour', async () => {
    const last = DEMO_CHAPTERS.at(-1);
    window.history.replaceState(null, '', `/?scene=demo#${last?.id ?? ''}`);
    render(<DemoPlayground />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('That is the tour');
    expect(screen.getAllByRole('link', { name: /Download for macOS/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the start' }));
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
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

  it('starts the cues once the frame is ready and moves on after the hold', () => {
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
      vi.advanceTimersByTime(4000);
    });
    expect(currentStep()).toBe('Library');
  });

  it('restarts a touched frame with a new generation and drops stale reports', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    fireEvent.click(screen.getByRole('button', { name: 'Replay chapter' }));
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'restart', generation: 1 }),
      window.location.origin,
    );
    report({ frame, type: 'complete', generation: 0 });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-label')).toBe('Pause');
  });

  it('keeps autoplay off under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<DemoPlayground />);
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-label')).toBe('Play');
  });

  it('switches the frame and the stage to the light theme', () => {
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames.some((frame) => (frame.getAttribute('src') ?? '').includes('theme=light'))).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).not.toBeNull();
  });
  it('names the group track for the visible frame once it is ready', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    report({ frame, type: 'ready' });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hints', chapterId: 'agent', settledIds: [], generation: 0 }),
      window.location.origin,
    );
  });

  it('draws the hint over the stage beside its anchor and leaves the app clickable', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    const note = screen.getByRole('note', { name: 'Hint 1 of 3' });
    expect(note.textContent).toContain('Send this follow-up to the agent');
    expect(screen.getByTestId('demo-coach-mark').className).toContain('pointer-events-none');
    expect(note.className).toContain('pointer-events-auto');
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
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    hint({ frame, hintId: 'agent-send' });
    fireEvent.keyDown(playgroundRoot(), { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByRole('button', { name: /Show hint/ })).not.toBeNull();
    fireEvent.keyDown(playgroundRoot(), { key: 'h' });
    expect(screen.getByRole('note', { name: 'Hint 1 of 3' })).not.toBeNull();
  });

  it('skips a hint, tells the frame and keeps that across a reload', () => {
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
    render(<DemoPlayground />);
    const frame = visibleFrame();
    report({ frame, type: 'ready' });
    tried({ frame, hintId: 'agent-answer' });
    tried({ frame, hintId: 'agent-answer' });
    expect(screen.getAllByText(/1 of 3/)).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem(HINT_PROGRESS_KEY) ?? '{}')).toEqual({
      agent: { tried: ['agent-answer'], skipped: [] },
    });
  });

  it('starts with the stored progress and resets only this group on replay', () => {
    window.localStorage.setItem(
      HINT_PROGRESS_KEY,
      JSON.stringify({
        agent: { tried: ['agent-answer', 'agent-files'], skipped: [] },
        setup: { tried: ['setup-start'], skipped: [] },
      }),
    );
    render(<DemoPlayground />);
    expect(screen.getAllByText(/2 of 3/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Replay chapter' }));
    expect(screen.getAllByText(/0 of 3/)).toHaveLength(2);
    expect(screen.getByText('1 of 5 tried').textContent).toBe('1 of 5 tried');
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
    tried({ frame, hintId: 'agent-answer' });
    expect(screen.getAllByText(/1 of 3/)).toHaveLength(2);
  });
});
