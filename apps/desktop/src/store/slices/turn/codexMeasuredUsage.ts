import { invoke } from '@tauri-apps/api/core';
import type { ProviderId, TurnEvent } from '@goodboy/types';

type UsageEvent = Extract<TurnEvent, { kind: 'usage' }>;

type RolloutContext = {
  readonly contextTokens: number;
  readonly contextWindow: number | null;
};

type Params = {
  readonly event: UsageEvent;
  readonly provider: ProviderId;
  readonly threadId: string | null;
};

export const codexMeasuredUsage = async ({
  event,
  provider,
  threadId,
}: Params): Promise<UsageEvent> => {
  if (provider !== 'codex' || threadId == null || threadId === '') {
    return event;
  }
  const measured = await invoke<RolloutContext | null>('codex_rollout_context', {
    threadId,
  }).catch(() => null);
  if (measured == null) {
    return event;
  }
  return { ...event, usage: { ...event.usage, contextTokens: measured.contextTokens } };
};
