import type { ProviderId } from '@goodboy/types';
import type { Resolution, ResolveSkip } from './types';

type ModelParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

export type ResolveNames = Readonly<{
  provider: (provider: ProviderId) => string;
  model: (params: ModelParams) => string;
}>;

type Params = {
  readonly resolution: Resolution;
  readonly names: ResolveNames;
};

type SkipParams = {
  readonly skip: ResolveSkip;
  readonly names: ResolveNames;
};

const reasonOf = ({ skip, names }: SkipParams): string => {
  const provider = names.provider(skip.provider);
  const model = skip.model === null ? provider : names.model({ ...skip, model: skip.model });
  switch (skip.reason) {
    case 'off':
      return `${provider} is Off`;
    case 'not-connected':
      return `${provider} is not connected`;
    case 'at-limit':
      return `${provider} is at its limit`;
    case 'hidden':
      return `${model} is hidden`;
    case 'cli-too-old':
      return `${provider} needs a newer CLI for ${model}`;
    case 'unknown-model':
      return `${model} is not available`;
    case 'backup-idle':
      return `${provider} is Backup only`;
  }
};

export const explainResolution = ({ resolution, names }: Params): string | null => {
  const using = names.model({ provider: resolution.provider, model: resolution.model });
  const pinSkip = resolution.skipped.find((skip) => skip.source !== 'auto' && skip.model !== null);
  if (pinSkip !== undefined && pinSkip.model !== null) {
    const pinned = names.model({ provider: pinSkip.provider, model: pinSkip.model });
    return `Pinned ${pinned} is skipped: ${reasonOf({ skip: pinSkip, names })}. Using ${using}.`;
  }
  if (resolution.source !== 'auto') {
    return null;
  }
  const [skip] = resolution.skipped;
  if (skip !== undefined) {
    return `Auto picks ${using}: ${reasonOf({ skip, names })}.`;
  }
  const isReferenceProvider = resolution.provider === 'anthropic';
  if (resolution.provider === resolution.defaultProvider && !isReferenceProvider) {
    return `Auto picks ${using}: ${names.provider(resolution.provider)} is the default provider.`;
  }
  return null;
};
