import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const lastReplyOf = ({ events }: Params): string | null => {
  const lastUser = events.map((event) => event.kind).lastIndexOf('user_text');
  const reply = events
    .slice(lastUser + 1)
    .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
    .join('')
    .trim();
  return reply === '' ? null : reply;
};
