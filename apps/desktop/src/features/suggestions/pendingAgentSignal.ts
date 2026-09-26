import type { ProviderId, TurnEvent } from '@goodboy/types';
import { decodeAuthRequiredMessage } from '../chat/turn';

export type PendingAgentSignal =
  | { readonly kind: 'permission'; readonly toolUseId: string; readonly toolName: string }
  | { readonly kind: 'auth'; readonly providerId: ProviderId };

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const pendingAgentSignal = ({ events }: Params): PendingAgentSignal | null => {
  const resolvedToolUseIds = new Set<string>();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined) {
      continue;
    }
    if (event.kind === 'done') {
      return null;
    }
    if (event.kind === 'permission_decision') {
      resolvedToolUseIds.add(event.toolUseId);
      continue;
    }
    if (event.kind === 'permission_request') {
      if (resolvedToolUseIds.has(event.toolUseId)) {
        continue;
      }
      return { kind: 'permission', toolUseId: event.toolUseId, toolName: event.toolName };
    }
    if (event.kind === 'error') {
      const authPayload = decodeAuthRequiredMessage(event.message);
      if (authPayload !== null) {
        return { kind: 'auth', providerId: authPayload.providerId };
      }
    }
  }
  return null;
};
