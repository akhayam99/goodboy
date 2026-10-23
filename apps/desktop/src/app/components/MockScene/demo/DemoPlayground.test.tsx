// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';

const visibleFrame = (): HTMLIFrameElement => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-shown="true"]');
  if (frame === null) {
    throw new Error('no visible frame');
  }
  return frame;
};

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(STAGE_BOX);
  window.history.replaceState(null, '', '/?scene=demo');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo playground', () => {
  it('loads no app frame while the stage has no room', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect());
    render(<DemoPlayground />);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('opens the first chapter and loads its first step in the stage', () => {
    render(<DemoPlayground />);
    const first = DEMO_CHAPTERS[0];
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(first.title);
    expect(visibleFrame().getAttribute('src')).toContain('scene=onboarding');
    expect(visibleFrame().getAttribute('src')).toContain('theme=dark');
  });

  it('opens the chapter named in the hash', () => {
    window.history.replaceState(null, '', '/?scene=demo#run');
    render(<DemoPlayground />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Run a workflow');
    expect(screen.getByText('Flow 2 of 8').textContent).toBe('Flow 2 of 8');
    expect(visibleFrame().getAttribute('src')).toContain('scene=c08-run-ready');
  });

  it('moves to the next chapter and writes it to the hash', () => {
    render(<DemoPlayground />);
    const second = DEMO_CHAPTERS[1];
    if (second === undefined) {
      throw new Error('missing second chapter');
    }
    fireEvent.click(screen.getByRole('button', { name: `Next: ${second.title}` }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(second.title);
    expect(window.location.hash).toBe(`#${second.id}`);
  });

  it('moves between chapters with the arrow keys', () => {
    render(<DemoPlayground />);
    const root = screen.getByRole('heading', { level: 1 }).closest('[tabindex="-1"]');
    if (root === null) {
      throw new Error('missing playground root');
    }
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[1]?.id ?? ''}`);
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    expect(window.location.hash).toBe(`#${DEMO_CHAPTERS[0].id}`);
  });

  it('remounts the stage frame on replay', () => {
    render(<DemoPlayground />);
    const before = visibleFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Replay chapter' }));
    const frames = document.querySelectorAll('iframe');
    expect(Array.from(frames).some((frame) => frame !== before)).toBe(true);
  });

  it('jumps to a step from the timeline and pauses autoplay', () => {
    window.history.replaceState(null, '', '/?scene=demo#run');
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Approval' }));
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-label')).toBe('Play');
    const current = document.querySelector('ol button[aria-current="step"]');
    expect(current?.textContent).toBe('Approval');
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

  it('switches the frame and the stage to the light theme', () => {
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames.some((frame) => (frame.getAttribute('src') ?? '').includes('theme=light'))).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).not.toBeNull();
  });
});
