// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { brandId, type ProviderRunId } from '@goodboy/types';
import { describe, expect, it, vi } from 'vitest';
import { STORY_QUESTION } from '../../scenes/story/storyContent';
import { STORY_PLANNER_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { DemoCue } from './directorTypes';
import { resolveFixCues } from './resolveFixCues';
import { storyAnswerCues } from './storyAnswerCues';
import { storyRevisionCues } from './storyRevisionCues';
import { storyStartCues } from './storyStartCues';
import { storyWorkCues } from './storyWorkCues';
import { TEXT_SENTENCE_MS } from './textCuesEndMs';

const MAX_SCRIPT_MS = 6500;
const MAX_RUN_MS = 11000;
const MIN_THINKING_MS = 1000;
const MAX_THINKING_MS = 1500;

type LabelParams = {
  readonly label: string;
};

const runOf = ({ label }: LabelParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-clock-${label}` });

type EndParams = {
  readonly cues: ReadonlyArray<DemoCue>;
};

const endOf = ({ cues }: EndParams): number => Math.max(...cues.map((cue) => cue.atMs));

type AnswerParams = {
  readonly answer: string;
};

const answerCuesOf = ({ answer }: AnswerParams): ReadonlyArray<DemoCue> =>
  storyAnswerCues({
    sessionId: STORY_SESSION_ID,
    agentId: STORY_PLANNER_ID,
    text: answer,
    answer,
  });

describe('the agent scripts a visitor waits on', () => {
  it('streams a sentence every 600 ms', () => {
    expect(TEXT_SENTENCE_MS).toBe(600);
  });

  it.each([
    ...STORY_QUESTION.options,
    'Retry with a backoff',
    'Keep the original credit. Record the retry. Check the key. Reuse the result.',
  ])('hands the planner to Codex and returns the plan within 6.5 s for %s', (answer) => {
    const cues = answerCuesOf({ answer });
    const times = cues.map((cue) => cue.atMs);
    expect(endOf({ cues })).toBeLessThanOrEqual(MAX_SCRIPT_MS);
    expect(times).toEqual([...times].sort((left, right) => left - right));
  });

  it('revises the plan within 6.5 s', () => {
    const cues = storyRevisionCues({
      sessionId: STORY_SESSION_ID,
      agentId: STORY_PLANNER_ID,
      text: 'Add the concurrent retries test.',
      runId: runOf({ label: 'revision' }),
      onDone: () => undefined,
    });
    expect(endOf({ cues })).toBeLessThanOrEqual(MAX_SCRIPT_MS);
  });

  it('coordinates both agents and ends the root turn within 11 s', () => {
    expect(
      endOf({ cues: storyWorkCues({ rootRun: runOf({ label: 'root' }) }) }),
    ).toBeLessThanOrEqual(MAX_RUN_MS);
  });

  it('plays the start of the session within 8 s, question last', () => {
    const cues = storyStartCues();
    expect(endOf({ cues })).toBeLessThanOrEqual(8000);
    expect(cues.filter((cue) => cue.atMs === endOf({ cues }))).toHaveLength(1);
  });

  it.each([
    ['the Claude to Codex hand-off', 'handoff'],
    ['the plan revision', 'revision'],
  ])('keeps a visible Thinking beat before the first output of %s', (_name, flow) => {
    const cues =
      flow === 'handoff'
        ? answerCuesOf({ answer: STORY_QUESTION.recommended })
        : storyRevisionCues({
            sessionId: STORY_SESSION_ID,
            agentId: STORY_PLANNER_ID,
            text: 'Add the concurrent retries test.',
            runId: runOf({ label: 'thinking' }),
            onDone: () => undefined,
          });
    const [, second] = cues.map((cue) => cue.atMs).sort((left, right) => left - right);
    expect(second).toBeGreaterThanOrEqual(MIN_THINKING_MS);
    expect(second).toBeLessThanOrEqual(MAX_THINKING_MS);
  });

  it('fixes the review comment within 5.5 s', () => {
    const cues = resolveFixCues({
      sessionId: STORY_SESSION_ID,
      agentId: STORY_PLANNER_ID,
      runId: runOf({ label: 'fix' }),
      attemptId: 'demo-clock-attempt',
      threadIds: [],
    });
    expect(endOf({ cues })).toBeLessThanOrEqual(MAX_SCRIPT_MS);
  });
});
