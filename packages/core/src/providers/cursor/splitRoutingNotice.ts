import type { ProviderRunId, TurnEvent } from '@goodboy/types';

const MARKER = '> Auto routed to ';
const NOTICE_PATTERN = /[ \t]*>[ \t]*(Auto routed to [^\n]*)\n?/;
const ASSISTANT_TEXT = 'assistant_text';

const pendingByRun = new Map<ProviderRunId, string>();

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly runId: ProviderRunId;
};

type HeldParams = {
  readonly text: string;
};

const heldTailLengthOf = ({ text }: HeldParams): number => {
  const line = text.slice(text.lastIndexOf('\n') + 1);
  const marker = line.search(/[ \t]*>[ \t]*Auto routed to /);
  if (marker !== -1) {
    return line.length - marker;
  }
  for (let size = Math.min(MARKER.length - 1, line.length); size > 0; size -= 1) {
    if (MARKER.startsWith(line.slice(line.length - size))) {
      return size;
    }
  }
  return 0;
};

type TextEventsParams = {
  readonly text: string;
  readonly template: Extract<TurnEvent, { kind: 'assistant_text' }>;
  readonly isFinal: boolean;
};

const textEventsOf = ({ text, template, isFinal }: TextEventsParams): ReadonlyArray<TurnEvent> => {
  const found = NOTICE_PATTERN.exec(text);
  const notice = found?.[1];
  const hasLine = found != null && notice !== undefined && (isFinal || found[0].endsWith('\n'));
  if (!hasLine) {
    return text.length > 0 ? [{ ...template, delta: text }] : [];
  }
  const before = text.slice(0, found.index);
  const rest = text.slice(found.index + found[0].length);
  const after = before.length > 0 && !before.endsWith('\n') && rest.length > 0 ? `\n${rest}` : rest;
  return [
    ...(before.length > 0 ? [{ ...template, delta: before }] : []),
    { kind: 'decision_note', runId: template.runId, message: notice.trim(), at: template.at },
    ...textEventsOf({ text: after, template, isFinal }),
  ];
};

export const splitRoutingNotice = ({ events, runId }: Params): ReadonlyArray<TurnEvent> =>
  events.flatMap((event): ReadonlyArray<TurnEvent> => {
    const pending = pendingByRun.get(runId) ?? '';
    if (event.kind !== ASSISTANT_TEXT) {
      pendingByRun.delete(runId);
      if (pending.length === 0) {
        return [event];
      }
      return [
        ...textEventsOf({
          text: pending,
          template: { kind: ASSISTANT_TEXT, runId, delta: '', at: event.at },
          isFinal: true,
        }),
        event,
      ];
    }
    const text = `${pending}${event.delta}`;
    const held = heldTailLengthOf({ text });
    const ready = text.slice(0, text.length - held);
    pendingByRun.delete(runId);
    if (held > 0) {
      pendingByRun.set(runId, text.slice(text.length - held));
    }
    return textEventsOf({ text: ready, template: event, isFinal: false });
  });
