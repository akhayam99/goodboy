import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const BRACKET_LINE = /\[[^\]\s]+ ([0-9a-f]{7,40})\]/;
const ONELINE_LINE = /^([0-9a-f]{7,40}) \S/m;

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
    const output = typeof event.output === 'string' ? event.output : '';
    const match = BRACKET_LINE.exec(output) ?? ONELINE_LINE.exec(output);
    return match?.[1] === undefined ? [] : [match[1].slice(0, 7)];
  });
  return shas[shas.length - 1] ?? null;
};
