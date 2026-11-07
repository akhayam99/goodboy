import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly since: number;
};

export const isRepliedAfter = ({ events, since }: Params): boolean =>
  events.some(
    (event) =>
      (event.kind === 'user_text' || event.kind === 'operator_text') &&
      Date.parse(event.at) > since,
  );
