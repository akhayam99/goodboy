import type { TurnEvent } from '@goodboy/types';
import type { TranscriptItem } from '../chat/utils/transcript-items';

type DecisionEvent = Extract<TurnEvent, { kind: 'permission_decision' }>;

type OpenAsk = Extract<TranscriptItem, { kind: 'permission_request' }>;

export type AnsweredAsk = Readonly<{
  toolUseId: string;
  toolName: string;
  input: unknown;
  decision: DecisionEvent['decision'];
  scope: DecisionEvent['scope'];
  reason: DecisionEvent['reason'];
}>;

export type AskBatch = Readonly<{
  open: ReadonlyArray<OpenAsk>;
  answered: ReadonlyArray<AnsweredAsk>;
}>;

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const askBatchOf = ({ events }: Params): AskBatch => {
  const open = new Map<string, OpenAsk>();
  const answered = new Map<string, AnsweredAsk>();
  for (const event of events) {
    if (event.kind === 'user_text') {
      open.clear();
      answered.clear();
      continue;
    }
    if (event.kind === 'tool_call_end') {
      open.delete(event.toolUseId);
      continue;
    }
    if (event.kind === 'permission_decision') {
      const ask = open.get(event.toolUseId);
      open.delete(event.toolUseId);
      if (ask !== undefined && event.decidedBy === 'user') {
        answered.set(event.toolUseId, {
          toolUseId: ask.toolUseId,
          toolName: ask.toolName,
          input: ask.input,
          decision: event.decision,
          scope: event.scope,
          reason: event.reason,
        });
      }
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
  return { open: [...open.values()], answered: [...answered.values()] };
};
