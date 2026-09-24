import { invoke } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';
import { fallbackStepOutputSummary, summarizeStepOutput } from '@goodboy/core';
import type { AgentId, TaskModelPreference } from '@goodboy/types';
import type { SetFn } from './slice-types';

export const SUMMARY_TIMEOUT_MS = 90_000;

type Params = {
  readonly set: SetFn;
  readonly agentId: AgentId;
  readonly output: string;
  readonly taskModel: TaskModelPreference;
  readonly workingDir?: string;
  readonly expectedOutput?: string;
};

type RunParams = Omit<Params, 'agentId' | 'set'>;

export type SummarizeAgentOutputResult = {
  readonly summary: string;
  readonly degraded: boolean;
  readonly error?: string;
};

const inFlightSummaries = new Map<AgentId, Promise<SummarizeAgentOutputResult>>();

const runSummarization = async ({
  output,
  taskModel,
  workingDir,
  expectedOutput,
}: RunParams): Promise<SummarizeAgentOutputResult> => {
  const runId = crypto.randomUUID();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('step output summarization timed out'));
      void Promise.resolve(invoke('summarize_cancel', { runId })).catch(() => undefined);
    }, SUMMARY_TIMEOUT_MS);
  });

  try {
    const summary = await Promise.race([
      summarizeStepOutput({
        ...taskModel,
        invokeFn: invoke,
        output,
        runId,
        ...(workingDir != null && { workingDir }),
        ...(expectedOutput != null && expectedOutput !== '' && { expectedOutput }),
      }),
      timeout,
    ]);
    return { summary, degraded: false };
  } catch (error) {
    const message = formatError(error);
    console.warn(`[step-output] summarization failed, using deterministic fallback: ${message}`);
    return { summary: fallbackStepOutputSummary({ output }), degraded: true, error: message };
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

export const summarizeAgentOutput = ({
  set,
  agentId,
  output,
  taskModel,
  workingDir,
  expectedOutput,
}: Params): Promise<SummarizeAgentOutputResult> => {
  const alreadyRunning = inFlightSummaries.get(agentId);
  if (alreadyRunning != null) {
    return alreadyRunning;
  }

  const running = runSummarization({
    output,
    taskModel,
    ...(workingDir != null && { workingDir }),
    ...(expectedOutput != null && { expectedOutput }),
  })
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
