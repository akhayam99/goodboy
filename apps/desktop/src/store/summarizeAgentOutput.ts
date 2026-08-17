import { invoke } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';
import { fallbackStepOutputSummary, summarizeStepOutput } from '@goodboy/core';
import type { AgentId, TaskModelPreference } from '@goodboy/types';

export const SUMMARY_TIMEOUT_MS = 90_000;

type Params = {
  readonly agentId: AgentId;
  readonly output: string;
  readonly taskModel: TaskModelPreference;
  readonly workingDir?: string;
  readonly expectedOutput?: string;
};

type RunParams = Omit<Params, 'agentId'>;

export type SummarizeAgentOutputResult = {
  readonly summary: string;
  readonly degraded: boolean;
  readonly error?: string;
};

export const summarizedStepOutputs = new Map<AgentId, string>();

export const stepSummaryDegraded = new Map<AgentId, boolean>();

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

export const summarizeAgentOutput = ({
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

  summarizedStepOutputs.set(agentId, output);
  const running = runSummarization({
    output,
    taskModel,
    ...(workingDir != null && { workingDir }),
    ...(expectedOutput != null && { expectedOutput }),
  })
    .then((result) => {
      stepSummaryDegraded.set(agentId, result.degraded);
      if (!result.degraded) {
        summarizedStepOutputs.delete(agentId);
      }
      return result;
    })
    .finally(() => {
      inFlightSummaries.delete(agentId);
    });
  inFlightSummaries.set(agentId, running);
  return running;
};
