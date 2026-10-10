import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { recordProviderRun } from './recordProviderRun';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly runId: string;
  readonly message: string;
};

export const feedAuthRefusal = ({ set, get, providerId, runId, message }: Params): void => {
  if (classifyProviderError({ message }).kind !== 'authentication') {
    return;
  }
  recordProviderRun({ set, get, providerId, runId, outcome: 'refused', message });
};
