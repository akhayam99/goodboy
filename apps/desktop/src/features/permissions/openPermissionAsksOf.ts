import type { TurnEvent, TurnState } from '@goodboy/types';
import type { TranscriptItem } from '../chat/utils/transcript-items';

export type OpenPermissionAsk = Extract<TranscriptItem, { kind: 'permission_request' }>;

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly turnState: TurnState | null | undefined;
};

const NO_ASKS: ReadonlyArray<OpenPermissionAsk> = [];

export const openPermissionAsksOf = ({
  events,
  turnState,
}: Params): ReadonlyArray<OpenPermissionAsk> => {
  if (turnState?.kind !== 'blocked') {
    return NO_ASKS;
  }
  const open = new Map<string, OpenPermissionAsk>();
  for (const event of events) {
    if (event.kind === 'user_text') {
      open.clear();
      continue;
    }
    if (event.kind === 'permission_decision' || event.kind === 'tool_call_end') {
      open.delete(event.toolUseId);
      continue;
    }
    if (event.kind === 'permission_request') {
      open.set(event.toolUseId, {
        kind: 'permission_request',
        key: `perm-req-${event.toolUseId}`,
        toolUseId: event.toolUseId,
        toolName: event.toolName,
        runId: event.runId,
        input: event.input,
        at: event.at,
      });
    }
  }
  return [...open.values()];
};
