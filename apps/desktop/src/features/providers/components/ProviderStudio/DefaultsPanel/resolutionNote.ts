import { explainResolution, type Resolution, type ResolveNames } from '@goodboy/core';
import { modelNameOf } from './modelNameOf';
import { PROVIDER_LABEL } from '../../../providerLabel';

export const RESOLVE_NAMES: ResolveNames = {
  provider: (provider) => PROVIDER_LABEL[provider],
  model: ({ provider, model }) => modelNameOf({ provider, model }),
};

type Params = {
  readonly resolution: Resolution;
};

export const isResolutionNoted = ({ resolution }: Params): boolean =>
  resolution.shadowed.length > 0 ||
  resolution.skipped.some((skip) => skip.source !== 'auto' && skip.model !== null);

export const isPinUnrunnable = ({ resolution }: Params): boolean =>
  resolution.source === 'auto' &&
  resolution.skipped.some((skip) => skip.source !== 'auto' && skip.model !== null);

export const resolutionNote = ({ resolution }: Params): string | null =>
  isResolutionNoted({ resolution })
    ? explainResolution({ resolution, names: RESOLVE_NAMES })
    : null;
