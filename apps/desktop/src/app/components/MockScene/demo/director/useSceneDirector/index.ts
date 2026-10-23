import { useEffect } from 'react';
import { useAppStore } from '../../../../../../store';
import { nowIso } from '../../../../../../store/slices/project-mounts/nowIso';
import { createPlaybackClock } from '../createPlaybackClock';
import { createSceneDirector, type SceneDirector } from '../createSceneDirector';
import { createSimulatedSend } from '../createSimulatedSend';
import { DEMO_TIMELINES } from '../demoTimelines';
import type { DemoTimeline } from '../directorTypes';
import type { DemoReport } from '../demoProtocol';
import { isDemoCommand } from '../isDemoCommand';
import { waitForPaint } from '../waitForPaint';

type Params = {
  readonly sceneName: string;
};

type ReportParams = {
  readonly report: DemoReport;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const STILL: DemoTimeline = { prepare: () => undefined, cues: [] };
const GENERIC_REPLY =
  'On it. In the app I would read the code this touches first, then report back here before anything is pushed.';

const isReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const post = ({ report }: ReportParams): void => {
  window.parent.postMessage(report, window.location.origin);
};

export const useSceneDirector = ({ sceneName }: Params): void => {
  useEffect(() => {
    let director: SceneDirector | null = null;
    let isDisposed = false;
    const isStandalone = window.parent === window;

    const boot = async (): Promise<void> => {
      await waitForPaint();
      if (isDisposed) {
        return;
      }
      const store = useAppStore;
      const timeline = DEMO_TIMELINES[sceneName]?.({ state: store.getState() }) ?? STILL;
      store.setState({
        sendTurn: createSimulatedSend({
          store,
          reply: timeline.reply ?? GENERIC_REPLY,
          now: () => nowIso({}),
        }),
      });
      director = createSceneDirector({
        timeline,
        store,
        clock: createPlaybackClock({ now: () => performance.now() }),
        isSettled: isReducedMotion(),
        now: () => nowIso({}),
        onReport: post,
      });
      director.start();
      if (isStandalone) {
        director.play();
      }
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || event.source !== window.parent) {
        return;
      }
      if (director === null || !isDemoCommand(event.data)) {
        return;
      }
      const command = event.data;
      if (command.type === 'restart') {
        if (command.generation > director.generation()) {
          director.restart({ generation: command.generation });
        }
        return;
      }
      if (command.generation !== director.generation()) {
        return;
      }
      if (command.type === 'play') {
        director.play();
        return;
      }
      director.pause();
    };

    const onInput = (event: Event): void => {
      if (!event.isTrusted) {
        return;
      }
      director?.pause();
    };

    window.addEventListener('message', onMessage);
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    void boot();
    return () => {
      isDisposed = true;
      director?.dispose();
      window.removeEventListener('message', onMessage);
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [sceneName]);
};
