// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_PROTOCOL } from './director/demoProtocol';
import { HINT_PROGRESS_KEY } from './hints/hintProgressKey';
import { dwellOf } from './hints/dwellOf';

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

const visibleFrame = (): HTMLIFrameElement => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-shown="true"]');
  if (frame === null) {
    throw new Error('no visible frame');
  }
  return frame;
};

type SceneParams = {
  readonly scene: string;
};

const framesOf = ({ scene }: SceneParams): ReadonlyArray<HTMLIFrameElement> =>
  Array.from(document.querySelectorAll('iframe')).filter((entry) =>
    (entry.getAttribute('src') ?? '').includes(`scene=${scene}&`),
  );

type SendParams = {
  readonly frame: HTMLIFrameElement;
  readonly type: string;
  readonly hintId?: string;
};

const send = ({ frame, type, hintId }: SendParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: 0,
          type,
          elapsedMs: 0,
          durationMs: 0,
          cueIndex: 0,
          ...(hintId === undefined ? {} : { hintId }),
        },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    );
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

type SeedParams = {
  readonly ids: ReadonlyArray<string>;
};

const seedProgress = ({ ids }: SeedParams) => {
  window.sessionStorage.setItem(
    HINT_PROGRESS_KEY,
    JSON.stringify(
      Object.fromEntries(
        ids.map((id) => [
          id,
          { tried: chapterOf({ id }).hints.map((entry) => entry.id), epoch: 0 },
        ]),
      ),
    ),
  );
};

type FinishParams = {
  readonly id: string;
  readonly frame: HTMLIFrameElement;
};

const finishGroup = ({ id, frame }: FinishParams) => {
  send({ frame, type: 'ready' });
  for (const entry of chapterOf({ id }).hints) {
    send({ frame, type: 'tried', hintId: entry.id });
    act(() => {
      vi.advanceTimersByTime(dwellOf({ hint: entry }));
    });
  }
};

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
  window.history.replaceState(null, '', '/');
});

describe('moving on from a group the visitor just finished', () => {
  it('keeps the live stage of the run for the next group instead of reseeding it', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const src = frame.getAttribute('src');
    finishGroup({ id: 'bring', frame });
    expect(window.location.hash).toBe('#direction');
    expect(visibleFrame()).toBe(frame);
    expect(frame.getAttribute('src')).toBe(src);
    expect(framesOf({ scene: 'story-direction' })).toHaveLength(0);
  });

  it('keeps it again from the direction to the guide', () => {
    seedProgress({ ids: ['bring'] });
    window.history.replaceState(null, '', '/?scene=demo#direction');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    finishGroup({ id: 'direction', frame });
    expect(window.location.hash).toBe('#guide');
    expect(visibleFrame()).toBe(frame);
    expect(framesOf({ scene: 'story-plan' })).toHaveLength(0);
  });

  it('opens the review on its own scene, which is another world', () => {
    seedProgress({ ids: ['bring', 'direction'] });
    window.history.replaceState(null, '', '/?scene=demo#guide');
    render(<DemoPlayground />);
    const frame = visibleFrame();
    finishGroup({ id: 'guide', frame });
    expect(window.location.hash).toBe('#ship');
    const review = framesOf({ scene: 'story-review' });
    expect(review).toHaveLength(1);
    send({ frame: review[0] ?? frame, type: 'ready' });
    expect(visibleFrame()).toBe(review[0]);
  });

  it('seeds the next group fresh on a direct entry', () => {
    seedProgress({ ids: ['bring'] });
    window.history.replaceState(null, '', '/?scene=demo#direction');
    render(<DemoPlayground />);
    expect(visibleFrame().getAttribute('src')).toContain('scene=story-direction&');
  });
});
