import type { ProviderId } from '@goodboy/types';

export type ProviderArgFlags = {
  readonly modelFlag: string;
  readonly effortFlag: string | null;
};

export const PROVIDER_ARG_FLAGS = {
  anthropic: { modelFlag: '--model', effortFlag: '--effort' },
  cursor: { modelFlag: '--model', effortFlag: null },
  codex: { modelFlag: '-m', effortFlag: null },
  gemini: { modelFlag: '--model', effortFlag: '--effort' },
  opencode: { modelFlag: '-m', effortFlag: '--variant' },
  openrouter: { modelFlag: '-m', effortFlag: '--variant' },
  moonshot: { modelFlag: '-m', effortFlag: '--variant' },
} as const satisfies Readonly<Record<ProviderId, ProviderArgFlags>>;

type ExtractSpawnModelParams = {
  readonly provider: ProviderId;
  readonly args: ReadonlyArray<string>;
};

export const extractSpawnModel = ({ provider, args }: ExtractSpawnModelParams): string => {
  const modelFlag = PROVIDER_ARG_FLAGS[provider].modelFlag;
  const modelFlagIndex = args.indexOf(modelFlag);
  if (modelFlagIndex === -1) {
    throw new Error(`resolved model args for ${provider} omit expected model flag ${modelFlag}`);
  }
  const spawnModel = args[modelFlagIndex + 1];
  if (spawnModel == null) {
    throw new Error(`resolved model args for ${provider} have ${modelFlag} with no value after it`);
  }
  return spawnModel;
};
