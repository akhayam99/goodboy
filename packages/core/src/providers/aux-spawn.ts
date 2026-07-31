import type { ModelEffort, ProviderId } from '@goodboy/types';
import { cliModelId } from './cliModelId';

export type AuxSpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

type Params = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort?: ModelEffort;
  readonly binary: string;
  readonly userMessage: string;
  readonly systemPrompt: string;
  readonly workingDir?: string;
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
    },
  });
