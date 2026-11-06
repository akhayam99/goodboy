import type { TurnEvent, TurnState } from '@goodboy/types';
import { askBatchOf } from '../../../features/permissions/askBatchOf';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly turnKind: TurnState['kind'] | undefined;
};

export type StoppedAnswer = Readonly<{
  toolUseId: string;
  toolName: string;
}>;

const UNKNOWN_TOOL = 'this tool';

const RESUMED: ReadonlySet<TurnState['kind']> = new Set<TurnState['kind']>(['running', 'starting']);

export const stoppedAnswerOf = ({ events, turnKind }: Params): StoppedAnswer | null => {
  if (turnKind !== undefined && RESUMED.has(turnKind)) {
    return null;
  }
  const last = events.at(-1);
  if (last?.kind !== 'permission_decision' || last.decision !== 'allow') {
    return null;
  }
  if (last.scope === undefined || last.scope === 'once' || last.scope === 'deny') {
    return null;
  }
  const { open, answered } = askBatchOf({ events });
  if (open.length > 0) {
    return null;
  }
  const ask = answered.find((candidate) => candidate.toolUseId === last.toolUseId);
  return { toolUseId: last.toolUseId, toolName: ask?.toolName ?? UNKNOWN_TOOL };
};
