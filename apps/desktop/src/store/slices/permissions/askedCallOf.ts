import type { IsoDateTime, TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly toolUseId: string;
};

type AskedCall = Readonly<{ input: unknown; at: IsoDateTime }>;

export const askedCallOf = ({ events, toolUseId }: Params): AskedCall | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === 'permission_request' && event.toolUseId === toolUseId) {
      return { input: event.input, at: event.at };
    }
  }
  return null;
};
