import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const agentBriefOf = ({ events }: Params): string | null => {
  const brief = events.find((event) => event.kind === 'user_text' || event.kind === 'handoff');
  if (brief?.kind !== 'user_text' && brief?.kind !== 'handoff') {
    return null;
  }
  return brief.text.trim() === '' ? null : brief.text;
};
