import { resolveSlot, type Resolution, type ResolveSlot } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly slot: ResolveSlot;
  readonly provider: ProviderId;
};

export const autoModelOn = ({ slot, provider }: Params): Resolution =>
  resolveSlot({ slot, context: { defaultProvider: provider } });
