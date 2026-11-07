import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const agentBriefOf = ({ events }: Params): string | null => {
  const brief = events.find((event) => event.kind === 'user_text');
  if (brief?.kind !== 'user_text') {
    return null;
  }
  return brief.text.trim() === '' ? null : brief.text.trim();
};
