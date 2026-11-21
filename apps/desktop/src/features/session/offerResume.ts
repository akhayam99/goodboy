import type { AgentId, SessionId, TurnState } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';

export type ResumeState = Pick<AppStore, 'undoable' | 'continueStoppedAgent' | 'agentTurnState'>;

type Params = {
  readonly getState: () => ResumeState;
  readonly sessionId: SessionId;
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly message: string;
  readonly showToast: ShowToast;
};

type StoppedParams = {
  readonly agentId: AgentId;
};

type StopMarkParams = {
  readonly turn: TurnState | undefined;
};

const stopMarkOf = ({ turn }: StopMarkParams): string => {
  if (turn === undefined) {
    return 'none';
  }
  return turn.kind === 'idle' ? `idle:${turn.lastActivityAt}` : turn.kind;
};

export const offerResume = ({
  getState,
  sessionId,
  agentIds,
  message,
  showToast,
}: Params): string | null => {
  if (agentIds.length === 0) {
    return null;
  }
  const marks = new Map<AgentId, string>(
    agentIds.map((agentId) => [agentId, stopMarkOf({ turn: getState().agentTurnState[agentId] })]),
  );
  const remaining = new Set<AgentId>(agentIds);
  const isStillStopped = ({ agentId }: StoppedParams): boolean => {
    const turn = getState().agentTurnState[agentId];
    return (
      turn?.kind !== 'running' &&
      turn?.kind !== 'starting' &&
      stopMarkOf({ turn }) === marks.get(agentId)
    );
  };
  return getState().undoable({
    message,
    showToast,
    actionLabel: NAMES.continue,
    doneMessage: agentIds.length === 1 ? 'Continued.' : `Continued ${agentIds.length} agents.`,
    isCurrent: () => [...remaining].some((agentId) => isStillStopped({ agentId })),
    undo: async () => {
      const eligible = [...remaining].filter((agentId) => isStillStopped({ agentId }));
      if (eligible.length === 0) {
        return false;
      }
      let failure: { readonly reason: unknown } | null = null;
      for (const agentId of eligible) {
        try {
          await getState().continueStoppedAgent({ sessionId, agentId });
          remaining.delete(agentId);
        } catch (error) {
          failure ??= { reason: error };
        }
      }
      if (failure !== null) {
        throw failure.reason;
      }
    },
  });
};
