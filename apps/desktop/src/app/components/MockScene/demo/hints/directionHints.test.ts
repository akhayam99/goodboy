// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { NAMES } from '../../../../../shared/utils/names';
import { STORY_QUESTION } from '../../scenes/story/storyContent';
import { STORY_PLANNER_ID, STORY_SESSION_ID, seedStoryWorld } from '../../scenes/story/storyWorld';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { installStoryDirection } from '../director/installStoryDirection';
import { DIRECTION_HINTS } from './directionHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
  seedStoryWorld({ stage: 'draft' });
  installStoryDirection({ store });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type QuestionParams = {
  readonly isChecked: boolean;
};

const questionOf = ({ isChecked }: QuestionParams): string => `
  <div data-oq-anchor>
    <button type="button" role="radio" aria-checked="${isChecked}" aria-label="${STORY_QUESTION.recommended}">${STORY_QUESTION.recommended}</button>
    <button type="button" role="radio" aria-checked="false" aria-label="Reject it with a 409">Reject it with a 409</button>
    <button type="button" data-demo-anchor="question-answer">Answer</button>
  </div>
`;

type RunParams = {
  readonly settledIds: ReadonlyArray<string>;
};

const run = ({ settledIds }: RunParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'direction' ? DIRECTION_HINTS : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'direction', settledIds, isGuarding: false });
  const lit = (): string | null =>
    reports.filter((report) => report.type === 'anchor').at(-1)?.hintId ?? null;
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  return { engine, lit, tried };
};

const settle = (): void => {
  vi.advanceTimersByTime(300);
};

const startSession = async () => {
  const workspaceId = store.getState().currentWorkspaceId;
  if (workspaceId === null) {
    throw new Error('no workspace');
  }
  await store.getState().startSessionFromDraft({
    workspaceId,
    start: { kind: 'workflow-run', goal: 'Fix HBL-412', run: async () => undefined },
  });
};

type AnswerParams = {
  readonly answer: string;
};

const answerWith = async ({ answer }: AnswerParams): Promise<void> => {
  await startSession();
  const [question] = store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];
  if (question === undefined) {
    throw new Error('no question');
  }
  await store
    .getState()
    .answerOpenQuestions(
      STORY_SESSION_ID,
      [{ id: question.id, text: question.text, answer }],
      STORY_PLANNER_ID,
    );
  vi.advanceTimersByTime(15000);
};

describe('the direction chapter when the question is answered another way', () => {
  it.each(STORY_QUESTION.options)(
    'completes the choose and answer steps when the answer is %s',
    async (answer) => {
      await answerWith({ answer });
      const { engine, tried, lit } = run({ settledIds: ['story-draft', 'story-start'] });
      settle();
      expect(tried()).toEqual(['story-choose', 'story-answer']);
      expect(lit()).toBeNull();
      engine.dispose();
    },
  );

  it('keeps the choose step open until the recommended answer is picked or the question is answered', async () => {
    await startSession();
    document.body.innerHTML = questionOf({ isChecked: false });
    const { engine, tried, lit } = run({ settledIds: ['story-draft', 'story-start'] });
    settle();
    expect(lit()).toBe('story-choose');
    expect(tried()).toEqual([]);
    document.body.innerHTML = questionOf({ isChecked: true });
    settle();
    expect(tried()).toEqual(['story-choose']);
    expect(lit()).toBe('story-answer');
    engine.dispose();
  });
});

describe('the step copy', () => {
  it('names the Start button the way the draft form does', () => {
    const start = DIRECTION_HINTS.find((hint) => hint.id === 'story-start');
    expect(start?.instruction).toContain(`**${NAMES.start}**`);
    expect(start?.instruction).not.toContain('Start workflow');
  });

  it('asks for the recommended answer in one short line', () => {
    const choose = DIRECTION_HINTS.find((hint) => hint.id === 'story-choose');
    expect(choose?.copy).toBe('Pick the recommended answer');
  });

  it('lets the hand-off end the chapter without a long hold', () => {
    const answer = DIRECTION_HINTS.find((hint) => hint.id === 'story-answer');
    expect(answer?.dwellMs).toBeUndefined();
  });
});
