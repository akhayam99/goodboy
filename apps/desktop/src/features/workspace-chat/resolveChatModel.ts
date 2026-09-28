import { extractSpawnModel, PROVIDER_ARG_FLAGS, resolveModelArgs } from '@goodboy/core';
import type { ModelKey, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly modelKey: ModelKey;
};

export type ChatModelArgs = {
  readonly model: string;
  readonly effort?: string;
};

export const resolveChatModel = ({ provider, modelKey }: Params): ChatModelArgs => {
  const { args } = resolveModelArgs({ provider, selection: { key: modelKey } });
  const model = extractSpawnModel({ provider, args });
  const effortFlag = PROVIDER_ARG_FLAGS[provider].effortFlag;
  const flagIndex = effortFlag === null ? -1 : args.indexOf(effortFlag);
  const codexEffort = args
    .find((argument) => argument.startsWith('model_reasoning_effort='))
    ?.split('"')[1];
  const effort = flagIndex >= 0 ? args[flagIndex + 1] : codexEffort;
  return effort === undefined ? { model } : { model, effort };
};
