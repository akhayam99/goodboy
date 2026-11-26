import type { TurnEvent } from '@goodboy/types';

const ROUTING_NOTICE_PATTERN = /[ \t]*>[ \t]*(Auto routed to [^\n]*)/;

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const splitRoutingNotice = ({ events }: Params): ReadonlyArray<TurnEvent> =>
  events.flatMap((event): ReadonlyArray<TurnEvent> => {
    if (event.kind !== 'assistant_text') {
      return [event];
    }
    const found = ROUTING_NOTICE_PATTERN.exec(event.delta);
    const notice = found?.[1];
    if (found == null || notice === undefined) {
      return [event];
    }
    const before = event.delta.slice(0, found.index).trimEnd();
    const after = event.delta.slice(found.index + found[0].length).replace(/^\n+/, '');
    return [
      ...(before.length > 0 ? [{ ...event, delta: before }] : []),
      {
        kind: 'decision_note' as const,
        runId: event.runId,
        message: notice.trim(),
        at: event.at,
      },
      ...(after.trim().length > 0 ? [{ ...event, delta: after }] : []),
    ];
  });
