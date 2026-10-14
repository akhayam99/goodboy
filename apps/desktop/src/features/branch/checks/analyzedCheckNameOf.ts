import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const CHECK_LINE = /^Check: (.+)$/m;

export const analyzedCheckNameOf = ({ events }: Params): string | null => {
  const kickoff = events.find((event) => event.kind === 'user_text');
  if (kickoff === undefined || kickoff.kind !== 'user_text') {
    return null;
  }
  return CHECK_LINE.exec(kickoff.text)?.[1]?.trim() ?? null;
};
