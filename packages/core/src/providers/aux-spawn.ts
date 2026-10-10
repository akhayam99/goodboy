import type { EffortLevel, ProviderId } from '@goodboy/types';
import { AuxTimedOutError } from './auxTimedOut';
import { cliModelId } from './cliModelId';

export type AuxSpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly isTimedOut?: boolean;
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
  invokeFn,
}: Params): Promise<AuxSpawnResult> => {
  const result = await invokeFn<AuxSpawnResult>('summarize_session', {
    args: {
      providerId,
      model: cliModelId({ provider: providerId, model }),
      ...(effort != null && { effort }),
      binary,
      userMessage,
      systemPrompt,
      ...(workingDir != null && { workingDir }),
      ...(runId != null && { runId }),
    },
  });
  if (result.isTimedOut === true) {
    throw new AuxTimedOutError();
  }
  return result;
};
