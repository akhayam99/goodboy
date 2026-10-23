import { useEffect } from 'react';
import { useAppStore } from '../../../../../../store';
import { nowIso } from '../../../../../../store/slices/project-mounts/nowIso';
import { createPlaybackClock } from '../createPlaybackClock';
import { createSceneDirector, type SceneDirector } from '../createSceneDirector';
import { createSimulatedSend } from '../createSimulatedSend';
import { createSimulatedAnswer } from '../createSimulatedAnswer';
import { createHintEngine, type HintEngine } from '../createHintEngine';
import { DEMO_CHAPTERS } from '../../demoChapters';
import { DEMO_TIMELINES } from '../demoTimelines';
import type { DemoTimeline } from '../directorTypes';
import type { DemoHintReport, DemoReport } from '../demoProtocol';
import { isDemoCommand } from '../isDemoCommand';
import { isDemoHintsCommand } from '../isDemoHintsCommand';
import { isDemoRevealCommand } from '../isDemoRevealCommand';
import { waitForPaint } from '../waitForPaint';

type Params = {
  readonly sceneName: string;
};

type ReportParams = {
  readonly report: DemoReport | DemoHintReport;
};

type ChapterParams = {
  readonly chapterId: string;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;
const STILL: DemoTimeline = { prepare: () => undefined, cues: [] };
const GENERIC_REPLY =
  'On it. In the app I would read the code this touches first, then report back here before anything is pushed.';
const GENERIC_ANSWER_REPLY = 'Thanks, that settles it. Carrying on with that choice.';

const isReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const post = ({ report }: ReportParams): void => {
  window.parent.postMessage(report, window.location.origin);
};

const chapterOf = ({ chapterId }: ChapterParams) =>
  DEMO_CHAPTERS.find((chapter) => chapter.id === chapterId);

const hintsOf = ({ chapterId }: ChapterParams) => chapterOf({ chapterId })?.hints ?? [];

type PlaceParams = ChapterParams & {
  readonly root: Document;
};

const placeOf = ({ chapterId, root }: PlaceParams): string | null =>
  chapterOf({ chapterId })?.placeOf?.({ root }) ?? null;

export const useSceneDirector = ({ sceneName }: Params): void => {
  useEffect(() => {
    let director: SceneDirector | null = null;
    let hints: HintEngine | null = null;
    let isDisposed = false;
    const isStandalone = window.parent === window;

    const boot = async (): Promise<void> => {
      await waitForPaint();
      if (isDisposed) {
        return;
      }
      const store = useAppStore;
      const timeline = DEMO_TIMELINES.get(sceneName)?.({ state: store.getState() }) ?? STILL;
      const now = () => nowIso({});
      store.setState({
        sendTurn: createSimulatedSend({
          store,
          reply: timeline.reply ?? GENERIC_REPLY,
          now,
          shouldClearDraft: true,
        }),
        answerOpenQuestions: createSimulatedAnswer({
          store,
          send: createSimulatedSend({
            store,
            reply: timeline.answerReply ?? GENERIC_ANSWER_REPLY,
            now,
            shouldClearDraft: false,
          }),
          now,
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
      const started = director;
      hints = createHintEngine({
        store,
        view: window,
        generation: () => started.generation(),
        hintsOf,
        placeOf,
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
      if (director === null) {
        return;
      }
      if (isDemoRevealCommand(event.data)) {
        if (event.data.generation === director.generation()) {
          hints?.reveal({ hintId: event.data.hintId });
        }
        return;
      }
      if (isDemoHintsCommand(event.data)) {
        if (event.data.generation === director.generation()) {
          hints?.setTrack({ chapterId: event.data.chapterId, settledIds: event.data.settledIds });
        }
        return;
      }
      if (!isDemoCommand(event.data)) {
        return;
      }
      const command = event.data;
      if (command.type === 'restart') {
        if (command.generation > director.generation()) {
          director.restart({ generation: command.generation });
          hints?.reset();
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
      director?.settle();
    };

    window.addEventListener('message', onMessage);
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    void boot();
    return () => {
      isDisposed = true;
      director?.dispose();
      hints?.dispose();
      window.removeEventListener('message', onMessage);
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [sceneName]);
};
