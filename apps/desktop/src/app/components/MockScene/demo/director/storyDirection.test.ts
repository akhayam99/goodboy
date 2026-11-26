// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import type { AgentId, TurnEvent } from '@goodboy/types';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { STORY_PLANNER, STORY_QUESTION } from '../../scenes/story/storyContent';
import {
  STORY_BRIEF,
  STORY_PLANNER_ID,
  STORY_ROOT_ID,
  STORY_SESSION_ID,
  seedStoryWorld,
} from '../../scenes/story/storyWorld';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { AUTO_STORY } from './autoStory';
import { demoRuns } from './demoRunRegistry';
import { installStoryDirection } from './installStoryDirection';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  elapsed = 0;
  seedStoryWorld({ stage: 'bring' });
  installStoryDirection({ store });
});

afterEach(() => {
  demoRuns.cancelAll();
  vi.useRealTimers();
});

let elapsed = 0;

const playTo = (ms: number): void => {
  vi.advanceTimersByTime(ms - elapsed);
  elapsed = ms;
};

const startSession = async () => {
  const workspaceId = store.getState().currentWorkspaceId;
  if (workspaceId === null) {
    throw new Error('no workspace');
  }
  return store.getState().startSessionFromDraft({
    workspaceId,
    start: { kind: 'workflow-run', goal: 'Fix HBL-412', run: async () => undefined },
  });
};

const plannerEvents = () => store.getState().transcripts[STORY_PLANNER_ID] ?? [];

const rootEvents = () => store.getState().transcripts[STORY_ROOT_ID] ?? [];

const textOf = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }): string =>
  events.flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : [])).join('');

const agentNames = (): ReadonlyArray<string> =>
  (store.getState().sessionPhaseRuns[STORY_SESSION_ID] ?? []).map((agent) => agent.name);

const openQuestions = () => store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];

const turnKind = ({ agentId }: { readonly agentId: AgentId }) =>
  store.getState().agentTurnState[agentId]?.kind;

describe('starting the story workflow', () => {
  it('opens one session linked to HBL-412 on the Lead, with the brief and nothing else', async () => {
    const session = await startSession();
    expect(session.id).toBe(STORY_SESSION_ID);
    expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID);
    expect(
      (store.getState().sessionExternalTasks[STORY_SESSION_ID] ?? []).map(
        (task) => task.identifier,
      ),
    ).toEqual(['HBL-412']);
    expect(agentNames()).toEqual(['Lead']);
    expect(rootEvents()).toMatchObject([{ kind: 'user_text', text: STORY_BRIEF }]);
    expect(turnKind({ agentId: STORY_ROOT_ID })).toBe('idle');
    expect(store.getState().selectedAgentId[STORY_SESSION_ID]).toBe(STORY_ROOT_ID);
    expect(openQuestions()).toHaveLength(0);
  });

  it('plays the Lead, hands off to the Planner and asks the question last', async () => {
    await startSession();
    playTo(400);
    expect(turnKind({ agentId: STORY_ROOT_ID })).toBe('running');
    expect(textOf({ events: rootEvents() })).toBe('');
    playTo(1600);
    expect(textOf({ events: rootEvents() })).toContain('This touches payments-api');
    playTo(2900);
    expect(textOf({ events: rootEvents() })).toBe(AUTO_STORY.first);
    expect(agentNames()).toEqual(['Lead']);
    playTo(3000);
    expect(agentNames()).toEqual(['Lead', 'Planner']);
    expect(turnKind({ agentId: STORY_ROOT_ID })).toBe('idle');
    expect(plannerEvents()).toHaveLength(0);
    playTo(3400);
    expect(plannerEvents().map((event) => event.kind)).toEqual(['user_text']);
    expect(turnKind({ agentId: STORY_PLANNER_ID })).toBe('running');
    expect(store.getState().selectedAgentId[STORY_SESSION_ID]).toBe(STORY_PLANNER_ID);
    playTo(4500);
    expect(plannerEvents().map((event) => event.kind)).toEqual(['user_text']);
    playTo(4600);
    expect(plannerEvents().at(-1)).toMatchObject({
      kind: 'tool_call_start',
      input: { command: STORY_PLANNER.command },
    });
    playTo(5400);
    expect(plannerEvents().at(-1)).toMatchObject({
      kind: 'tool_call_end',
      output: STORY_PLANNER.output,
    });
    playTo(6200);
    expect(textOf({ events: plannerEvents() }).length).toBeGreaterThan(0);
    expect(textOf({ events: plannerEvents() })).not.toBe(STORY_PLANNER.intro);
    expect(openQuestions()).toHaveLength(0);
    expect(turnKind({ agentId: STORY_PLANNER_ID })).toBe('running');
    playTo(7499);
    expect(openQuestions()).toHaveLength(0);
    playTo(7500);
    expect(textOf({ events: plannerEvents() })).toBe(STORY_PLANNER.intro);
    const asked = openQuestions();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      text: STORY_QUESTION.text,
      isBlocking: true,
      status: 'open',
      createdByAgentId: STORY_PLANNER_ID,
    });
    expect(turnKind({ agentId: STORY_PLANNER_ID })).toBe('idle');
    const planner = (store.getState().sessionPhaseRuns[STORY_SESSION_ID] ?? []).find(
      (agent) => agent.id === STORY_PLANNER_ID,
    );
    expect(planner?.status).toBe('completed');
  });

  it('stops playing when the visitor leaves the run', async () => {
    await startSession();
    playTo(1000);
    demoRuns.cancelAll();
    playTo(8000);
    expect(agentNames()).toEqual(['Lead']);
    expect(openQuestions()).toHaveLength(0);
  });
});

describe('writing the brief of the draft', () => {
  const workspaceId = () => {
    const id = store.getState().currentWorkspaceId;
    if (id === null) {
      throw new Error('no workspace');
    }
    return id;
  };

  const goalOf = (): string =>
    selectSessionDraft({ state: store.getState(), workspaceId: workspaceId() }).workflowGoal;

  const openWithBrief = () => {
    store.getState().patchSessionDraft({
      workspaceId: workspaceId(),
      patch: { workflowGoal: STORY_BRIEF },
    });
    store.getState().openSessionDraft();
  };

  it('opens with an empty box, then fills it in step by step until the brief is complete', () => {
    openWithBrief();
    expect(goalOf()).toBe('');
    playTo(1299);
    expect(goalOf()).toBe('');
    playTo(1300);
    expect(STORY_BRIEF.startsWith(goalOf())).toBe(true);
    expect(goalOf().length).toBeGreaterThan(0);
    playTo(2200);
    expect(goalOf().length).toBeGreaterThan(STORY_BRIEF.split('\n')[0]?.length ?? 0);
    expect(goalOf()).not.toBe(STORY_BRIEF);
    playTo(3400);
    expect(goalOf()).toBe(STORY_BRIEF);
  });

  it('stops writing once the visitor presses Start', async () => {
    openWithBrief();
    playTo(2200);
    const partial = goalOf();
    await startSession();
    playTo(5000);
    expect(goalOf()).toBe(partial);
  });
});

describe('answering the planner question', () => {
  type AnswerParams = {
    readonly choice?: string;
  };

  const answer = async ({ choice = STORY_QUESTION.recommended }: AnswerParams = {}) => {
    await startSession();
    playTo(7500);
    const [question] = store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];
    if (question === undefined) {
      throw new Error('no question');
    }
    await store
      .getState()
      .answerOpenQuestions(
        STORY_SESSION_ID,
        [{ id: question.id, text: question.text, answer: choice }],
        STORY_PLANNER_ID,
      );
  };

  const plannerSaid = (): string =>
    plannerEvents()
      .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
      .join('');

  it.each([
    ['Return the original credit', 'A repeated webhook returns the original credit'],
    ['Reject it with a 409', 'a repeated webhook that is rejected with a 409'],
    ['Return 200 and log a warning', 'a repeated webhook that returns 200 and logs a warning'],
  ])('has the planner speak about the option %s', async (choice, sentence) => {
    await answer({ choice });
    vi.advanceTimersByTime(6500);
    expect(plannerSaid()).toContain(sentence);
    for (const other of STORY_QUESTION.options.filter((option) => option !== choice)) {
      expect(plannerSaid()).not.toContain(
        `A repeated webhook ${STORY_QUESTION.outcomes[other]}, so I wrote the plan`,
      );
    }
  });

  it('repeats a typed answer back to the visitor', async () => {
    await answer({ choice: 'Retry with a backoff' });
    vi.advanceTimersByTime(6500);
    expect(plannerSaid()).toContain('You said "Retry with a backoff"');
  });

  it('moves the planner from Claude to Codex when Claude is at its limit', async () => {
    await answer();
    expect(plannerEvents().some((event) => event.kind === 'decision_note')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(plannerEvents().some((event) => event.kind === 'decision_note')).toBe(false);
    expect(store.getState().agentTurnState[STORY_PLANNER_ID]?.kind).toBe('running');
    vi.advanceTimersByTime(200);
    expect(plannerEvents().some((event) => event.kind === 'decision_note')).toBe(true);
    const planner = (store.getState().sessionPhaseRuns[STORY_SESSION_ID] ?? []).find(
      (agent) => agent.id === STORY_PLANNER_ID,
    );
    expect(planner?.providerOverride).toBe('codex');
    expect(store.getState().sessionPlans[STORY_SESSION_ID] ?? []).toHaveLength(0);
  });

  it('lets Codex finish the same task and return the plan with the answer kept', async () => {
    await answer();
    vi.advanceTimersByTime(6500);
    expect(store.getState().agentTurnState[STORY_PLANNER_ID]?.kind).toBe('idle');
    const plans = store.getState().sessionPlans[STORY_SESSION_ID] ?? [];
    expect(plans).toHaveLength(1);
    expect(plans[0]?.bodyMd).toContain('replay test');
    expect(store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? []).toHaveLength(0);
    const answered = store.getState().sessionAnsweredQuestions[STORY_SESSION_ID] ?? [];
    expect(answered[0]?.userAnswer).toBe(STORY_QUESTION.recommended);
    const sent = plannerEvents().find(
      (event) => event.kind === 'user_text' && event.text.includes(STORY_QUESTION.recommended),
    );
    expect(sent).toBeDefined();
  });
});
