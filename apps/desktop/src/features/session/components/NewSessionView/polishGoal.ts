import { polishWorkflowGoal } from '@goodboy/core';
import type { ModelEffort, ProviderId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';

export const GOAL_POLISH_TIMEOUT_MS = 15_000;

type Params = {
  readonly goal: string;
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort?: ModelEffort;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  readonly workingDir?: string;
  readonly timeoutMs?: number;
};

export type GoalPolishResult = {
  readonly goal: string;
  readonly accepted: boolean;
  readonly error: string | null;
};

type RejectedParams = {
  readonly goal: string;
  readonly error: string;
};

const rejected = ({ goal, error }: RejectedParams): GoalPolishResult => ({
  goal,
  accepted: false,
  error,
});

export const polishGoal = async ({
  goal,
  providerId,
  model,
  effort,
  invokeFn,
  workingDir,
  timeoutMs = GOAL_POLISH_TIMEOUT_MS,
}: Params): Promise<GoalPolishResult> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error('goal polishing timed out')), timeoutMs);
  });

  try {
    const polished = await Promise.race([
      polishWorkflowGoal(
        {
          providerId,
          model,
          ...(effort != null && { effort }),
          invokeFn,
          ...(workingDir != null && { workingDir }),
        },
        goal,
      ),
      timeout,
    ]);
    if (polished === null) {
      return rejected({ goal, error: 'the model did not return a polished goal' });
    }
    return { goal: polished, accepted: true, error: null };
  } catch (error) {
    return rejected({ goal, error: formatError(error) });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};
