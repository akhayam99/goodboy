import type { IsoDateTime, TurnEvent } from '@goodboy/types';

export type AssistantMessage = Readonly<{ text: string; at: IsoDateTime }>;

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const isAssistantTextEvent = (
  event: TurnEvent,
): event is Extract<TurnEvent, { kind: 'assistant_text' }> => event.kind === 'assistant_text';

export const lastAssistantMessage = ({ events }: Params): AssistantMessage | null => {
  const assistantEvents = events.filter(isAssistantTextEvent);
  const lastEvent = assistantEvents[assistantEvents.length - 1];
  if (lastEvent === undefined) {
    return null;
  }
  const joined = assistantEvents
    .filter((event) => event.runId === lastEvent.runId)
    .map((event) => event.delta)
    .join('');
  const trimmed = joined.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return { text: trimmed, at: lastEvent.at };
};
