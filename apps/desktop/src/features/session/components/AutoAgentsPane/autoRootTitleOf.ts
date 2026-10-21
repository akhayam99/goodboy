import type { TurnEvent } from '@goodboy/types';
import { agentHeadingOf } from '../AgentDetailPane/agentHeadingOf';
import { briefLineOf } from '../AgentDetailPane/briefLineOf';
import { firstLineOf } from '../AgentDetailPane/firstLineOf';

type Params = {
  readonly name: string;
  readonly ask: string | null;
  readonly events: ReadonlyArray<TurnEvent>;
};

export const autoRootTitleOf = ({ name, ask, events }: Params): string =>
  agentHeadingOf({
    name,
    kind: 'auto',
    brief: (ask === null ? null : firstLineOf({ text: ask })) ?? briefLineOf({ events }),
  });
