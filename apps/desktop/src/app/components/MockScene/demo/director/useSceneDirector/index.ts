import { useEffect } from 'react';
import { useAppStore } from '../../../../../../store';
import {
  applyDocumentTheme,
  getAppliedTheme,
  subscribeAppliedTheme,
} from '../../../../../../shared/lib/theme';
import { nowIso } from '../../../../../../store/slices/project-mounts/nowIso';
import { createPlaybackClock } from '../createPlaybackClock';
import { createSceneDirector, type SceneDirector } from '../createSceneDirector';
import { createSimulatedSend } from '../createSimulatedSend';
import { createSimulatedAnswer } from '../createSimulatedAnswer';
import { createReplyRuns } from '../createReplyRuns';
import { installDemoSearch } from '../installDemoSearch';
import { installDemoMonitor } from '../installDemoMonitor';
import { installDemoContext } from '../installDemoContext';
import { createSimulatedSpawn } from '../createSimulatedSpawn';
import { createHintEngine, type HintEngine } from '../createHintEngine';
import { DEMO_CHAPTERS } from '../../demoChapters';
import { DEMO_TIMELINES } from '../demoTimelines';
import type { DemoTimeline } from '../directorTypes';
import {
  DEMO_PROTOCOL,
  type DemoHintReport,
  type DemoReport,
  type DemoThemeMessage,
} from '../demoProtocol';
import { isDemoCommand } from '../isDemoCommand';
import { isDemoHintsCommand } from '../isDemoHintsCommand';
import { isDemoRevealCommand } from '../isDemoRevealCommand';
import { readDemoThemeMessage } from '../readDemoThemeMessage';
import { readDemoShortcutCommand } from '../readDemoShortcutCommand';
import { dispatchDemoShortcut } from '../dispatchDemoShortcut';
import { waitForPaint } from '../waitForPaint';

type Params = {
  readonly sceneName: string;
};

type ReportParams = {
  readonly report: DemoReport | DemoHintReport | DemoThemeMessage;
};

type ChapterParams = {
  readonly chapterId: string;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;
const STILL: DemoTimeline = { prepare: () => undefined, cues: [] };
const GENERIC_REPLY =
  'On it. In the app I would read the code this touches first, then report back here before anything is pushed.';
const GENERIC_SPAWN_REPLY =
  'Starting from the plan. In the app I would make the change, run the tests it touches and report back here before anything is pushed.';
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
    let expectedTheme = getAppliedTheme();
    const runs = createReplyRuns();
    const isStandalone = window.parent === window;

    const boot = async (): Promise<void> => {
      await waitForPaint();
      if (isDisposed) {
        return;
      }
      const store = useAppStore;
      const timeline = DEMO_TIMELINES.get(sceneName)?.({ state: store.getState() }) ?? STILL;
      const now = () => nowIso({});
      installDemoSearch({ store });
      installDemoMonitor({ store });
      installDemoContext({ store });
      store.setState({
        sendTurn: createSimulatedSend({
          store,
          reply: timeline.reply ?? GENERIC_REPLY,
          now,
          shouldClearDraft: true,
          runs,
        }),
        answerOpenQuestions: createSimulatedAnswer({
          store,
          send: createSimulatedSend({
            store,
            reply: timeline.answerReply ?? GENERIC_ANSWER_REPLY,
            now,
            shouldClearDraft: false,
            runs,
          }),
          now,
        }),
        spawnAgent: createSimulatedSpawn({
          store,
          send: createSimulatedSend({
            store,
            reply: GENERIC_SPAWN_REPLY,
            now,
            shouldClearDraft: false,
            runs,
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
      expectedTheme = getAppliedTheme();
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
      const themeMessage = readDemoThemeMessage({ data: event.data });
      if (themeMessage !== null) {
        if (themeMessage.generation === director.generation()) {
          expectedTheme = themeMessage.theme;
          applyDocumentTheme({ theme: themeMessage.theme });
        }
        return;
      }
      const shortcutCommand = readDemoShortcutCommand({ data: event.data });
      if (shortcutCommand !== null) {
        if (shortcutCommand.generation === director.generation()) {
          dispatchDemoShortcut({ code: shortcutCommand.code });
        }
        return;
      }
      if (!isDemoCommand(event.data)) {
        return;
      }
      const command = event.data;
      if (command.type === 'restart') {
        if (command.generation > director.generation()) {
          runs.cancel();
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

    const unwatchTheme = subscribeAppliedTheme(() => {
      const applied = getAppliedTheme();
      if (applied === expectedTheme || director === null) {
        return;
      }
      expectedTheme = applied;
      post({
        report: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: director.generation(),
          type: 'theme',
          theme: applied,
        },
      });
    });

    window.addEventListener('message', onMessage);
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    void boot();
    return () => {
      isDisposed = true;
      runs.dispose();
      director?.dispose();
      hints?.dispose();
      unwatchTheme();
      window.removeEventListener('message', onMessage);
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, [sceneName]);
};
