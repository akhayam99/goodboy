import { invokeCommand } from '../../../shared/lib/invokeCommand';
import {
  fallbackStepOutputSummary,
  summarizeStepOutput,
  type BackgroundAttempt,
} from '@goodboy/core';
import type { AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import { runHelperTask } from '../providerLimits/runHelperTask';
import type { GetFn, SetFn } from '../../slice-types';

export const SUMMARY_TIMEOUT_MS = 90_000;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly output: string;
  readonly taskModel: TaskModelPreference;
  readonly workingDir?: string;
  readonly expectedOutput?: string;
};

type RunParams = Pick<Params, 'output' | 'workingDir' | 'expectedOutput'> & {
  readonly taskModel: TaskModelPreference;
};

export type SummarizeAgentOutputResult = {
  readonly summary: string;
  readonly degraded: boolean;
  readonly error?: string;
  readonly model: TaskModelPreference;
  readonly attempts: ReadonlyArray<BackgroundAttempt>;
};

const inFlightSummaries = new Map<AgentId, Promise<SummarizeAgentOutputResult>>();

const summarizeOnce = async ({
  output,
  taskModel,
  workingDir,
  expectedOutput,
}: RunParams): Promise<string> => {
  const runId = crypto.randomUUID();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('step output summarization timed out'));
      void Promise.resolve(invokeCommand('summarize_cancel', { runId })).catch(() => undefined);
    }, SUMMARY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      summarizeStepOutput({
        ...taskModel,
        invokeFn: invokeCommand,
        output,
        runId,
        ...(workingDir != null && { workingDir }),
        ...(expectedOutput != null && expectedOutput !== '' && { expectedOutput }),
      }),
      timeout,
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

type RecordParams = {
  readonly set: SetFn;
  readonly agentId: AgentId;
  readonly output: string;
  readonly isDegraded: boolean;
};

const recordSummaryOutcome = ({ set, agentId, output, isDegraded }: RecordParams): void => {
  set((state) => {
    const { [agentId]: _stale, ...kept } = state.degradedStepOutputs;
    return {
      stepSummaryDegraded: { ...state.stepSummaryDegraded, [agentId]: isDegraded },
      degradedStepOutputs: isDegraded ? { ...kept, [agentId]: output } : kept,
    };
  });
};

const summarizeWithFallback = async ({
  set,
  get,
  sessionId,
  output,
  taskModel,
  workingDir,
  expectedOutput,
}: Params): Promise<SummarizeAgentOutputResult> => {
  const result = await runHelperTask({
    set,
    get,
    sessionId,
    first: taskModel,
    run: (model) =>
      summarizeOnce({
        output,
        taskModel: model,
        ...(workingDir != null && { workingDir }),
        ...(expectedOutput != null && { expectedOutput }),
      }),
  });
  if (result.ok) {
    return {
      summary: result.value,
      degraded: false,
      model: result.model,
      attempts: result.attempts,
    };
  }
  console.warn(
    `[step-output] summarization failed on ${result.attempts.length} attempts, using deterministic fallback: ${result.error}`,
  );
  return {
    summary: fallbackStepOutputSummary({ output }),
    degraded: true,
    error: result.error,
    model: result.model,
    attempts: result.attempts,
  };
};

export const summarizeAgentOutput = (params: Params): Promise<SummarizeAgentOutputResult> => {
  const { set, agentId, output } = params;
  const alreadyRunning = inFlightSummaries.get(agentId);
  if (alreadyRunning != null) {
    return alreadyRunning;
  }

  const running = summarizeWithFallback(params)
    .then((result) => {
      recordSummaryOutcome({ set, agentId, output, isDegraded: result.degraded });
      return result;
    })
    .finally(() => {
      inFlightSummaries.delete(agentId);
    });
  inFlightSummaries.set(agentId, running);
  return running;
};
