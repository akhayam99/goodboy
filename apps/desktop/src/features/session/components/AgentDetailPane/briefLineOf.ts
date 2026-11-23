import type { TurnEvent } from '@goodboy/types';
import { firstLineOf } from '../../../../shared/utils/firstLineOf';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const briefLineOf = ({ events }: Params): string | null => {
  const brief = events.find((event) => event.kind === 'user_text');
  if (brief?.kind !== 'user_text') {
    return null;
  }
  return firstLineOf({ text: brief.text });
};
