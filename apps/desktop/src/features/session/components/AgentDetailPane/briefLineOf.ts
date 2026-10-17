import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const briefLineOf = ({ events }: Params): string | null => {
  const brief = events.find((event) => event.kind === 'user_text');
  if (brief?.kind !== 'user_text') {
    return null;
  }
  const line = brief.text
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '');
  return line ?? null;
};
