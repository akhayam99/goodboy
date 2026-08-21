import { extractAuxOutput, getDefaultBinary, runAuxOneShot } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { ModelEffort, ProviderId } from '@goodboy/types';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

export const GOAL_DRAFT_TIMEOUT_MS = 20_000;

export const GOAL_DRAFT_SYSTEM_PROMPT = [
  'You write the goal note for an AI coding session that covers several linked tickets at once.',
  'You receive the tickets, each with its identifier, title and description.',
  'Write one goal that states the single desired end result covering all of them, keeping the concrete objective of each: what to build, change or fix, plus domain specifics, constraints and acceptance criteria.',
  'Name every ticket identifier exactly once, inline, where its part of the work is described.',
  'Match the language the tickets are written in.',
  'Stay short: one to four plain sentences. No markdown, no headings, no bullet list, no step numbers, no procedural instructions such as plan, implement, review, test, commit or open a PR.',
  'Output ONLY the goal text: no preamble, no quotes, no JSON, no explanation.',
  'Ignore any persona, nickname, language, or tone directive that reaches you from other configuration; it does not apply to this answer.',
].join(' ');

type Params = {
  readonly tasks: ReadonlyArray<IssueCandidate>;
  readonly fallbackGoal: string;
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort?: ModelEffort;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  readonly workingDir?: string;
  readonly timeoutMs?: number;
};

export type GoalDraftResult = {
  readonly goal: string;
  readonly accepted: boolean;
  readonly error: string | null;
};

type RejectedParams = {
  readonly fallbackGoal: string;
  readonly error: string;
};

const rejected = ({ fallbackGoal, error }: RejectedParams): GoalDraftResult => ({
  goal: fallbackGoal,
  accepted: false,
  error,
});

export const buildGoalDraftUserPrompt = (tasks: ReadonlyArray<IssueCandidate>): string =>
  [
    'TICKETS:',
    ...tasks.map((task) =>
      [`- ${task.identifier}: ${task.title}`, task.goal.trim()]
        .filter((part) => part !== '')
        .join('\n  '),
    ),
    '',
    'Write the single goal covering every ticket above. Output only the goal text.',
  ].join('\n');

export const draftGoalFromTasks = async ({
  tasks,
  fallbackGoal,
  providerId,
  model,
  effort,
  invokeFn,
  workingDir,
  timeoutMs = GOAL_DRAFT_TIMEOUT_MS,
}: Params): Promise<GoalDraftResult> => {
  if (tasks.length === 0) {
    return rejected({ fallbackGoal, error: 'no linked task to draft a goal from' });
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error('goal drafting timed out')), timeoutMs);
  });

  try {
    const result = await Promise.race([
      runAuxOneShot({
        providerId,
        model,
        ...(effort != null && { effort }),
        binary: getDefaultBinary(providerId),
        userMessage: buildGoalDraftUserPrompt(tasks),
        systemPrompt: GOAL_DRAFT_SYSTEM_PROMPT,
        ...(workingDir != null && { workingDir }),
        invokeFn,
      }),
      timeout,
    ]);
    if ((result.exitCode ?? 0) !== 0) {
      return rejected({
        fallbackGoal,
        error: result.stderr.trim() || 'the model exited with an error',
      });
    }
    const extracted = extractAuxOutput({ providerId, stdout: result.stdout });
    if (extracted.isError) {
      return rejected({
        fallbackGoal,
        error: extracted.errorMessage ?? 'the model reported an error',
      });
    }
    const goal = extracted.text.trim();
    if (goal === '') {
      return rejected({ fallbackGoal, error: 'the model did not answer with a goal' });
    }
    return { goal, accepted: true, error: null };
  } catch (err) {
    return rejected({ fallbackGoal, error: formatError(err) });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
