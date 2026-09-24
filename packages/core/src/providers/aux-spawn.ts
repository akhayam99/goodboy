import type { EffortLevel, InvocationContext, ProviderId } from '@goodboy/types';
import { cliModelId } from './cliModelId';
import { estimateSpendReservation } from '../budget/reservation';

export type AuxSpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

type Params = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort?: EffortLevel;
  readonly binary: string;
  readonly userMessage: string;
  readonly systemPrompt: string;
  readonly workingDir?: string;
  readonly runId?: string;
  readonly invocation?: InvocationContext;
  readonly invokeFn: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
};

export const runAuxOneShot = async ({
  providerId,
  model,
  effort,
  binary,
  userMessage,
  systemPrompt,
  workingDir,
  runId,
  invocation,
  invokeFn,
}: Params): Promise<AuxSpawnResult> =>
  invokeFn<AuxSpawnResult>('summarize_session', {
    args: {
      providerId,
      model: cliModelId({ provider: providerId, model }),
      ...(effort != null && { effort }),
      binary,
      userMessage,
      systemPrompt,
      ...(workingDir != null && { workingDir }),
      ...(runId != null && { runId }),
      ...(invocation != null && {
        invocation: {
          ...invocation,
          spendReservation: estimateSpendReservation({
            providerId,
            model,
            prompt: `${systemPrompt}\n\n${userMessage}`,
            allowOverBudget: invocation.spendReservation?.allowOverBudget === true,
          }),
        },
      }),
    },
  });
