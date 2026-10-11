import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const COMMIT_LINE = /\[[^\]\s]+ ([0-9a-f]{7,40})\]/;

export const commitOf = ({ events }: Params): string | null => {
  const commitCalls = new Set(
    events.flatMap((event) =>
      event.kind === 'tool_call_start' && JSON.stringify(event.input).includes('git commit')
        ? [event.toolUseId]
        : [],
    ),
  );
  const shas = events.flatMap((event) => {
    if (event.kind !== 'tool_call_end' || event.isError || !commitCalls.has(event.toolUseId)) {
      return [];
    }
    const match = COMMIT_LINE.exec(typeof event.output === 'string' ? event.output : '');
    return match?.[1] === undefined ? [] : [match[1].slice(0, 7)];
  });
  return shas[shas.length - 1] ?? null;
};
