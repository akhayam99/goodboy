import { modeSupportFor } from '@goodboy/core';
import type { ClaudePermissionMode, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import { modeCopyOf } from '../modeCopy';

type Params = {
  readonly provider: ProviderId;
  readonly mode: ClaudePermissionMode;
};

export const fallbackModeLine = ({ provider, mode }: Params): string | null => {
  const support = modeSupportFor({ provider, mode });
  if (support.support !== 'fallback') {
    return null;
  }
  const runs = modeCopyOf({ mode: support.runsAs }).label;
  const asked = modeCopyOf({ mode }).label;
  return `${runs} · ${asked} isn't available on ${PROVIDER_LABEL[provider]}`;
};
