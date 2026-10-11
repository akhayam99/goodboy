import { explainResolution, type Resolution } from '@goodboy/core';
import { RESOLVE_NAMES } from '../../../resolveNames';

type Params = {
  readonly resolution: Resolution;
};

export const isResolutionNoted = ({ resolution }: Params): boolean =>
  resolution.skipped.some((skip) => skip.source !== 'auto' && skip.model !== null);

export const isPinUnrunnable = ({ resolution }: Params): boolean =>
  resolution.source === 'auto' &&
  resolution.skipped.some((skip) => skip.source !== 'auto' && skip.model !== null);

export const resolutionNote = ({ resolution }: Params): string | null =>
  isResolutionNoted({ resolution })
    ? explainResolution({ resolution, names: RESOLVE_NAMES })
    : null;
