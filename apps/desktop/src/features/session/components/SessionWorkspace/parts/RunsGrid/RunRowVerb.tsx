import type { Agent, SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { usePendingAction } from '../../../../../../shared/hooks/usePendingAction';
import { NAMES } from '../../../../../../shared/utils/names';
import { useAppStore } from '../../../../../../store';
import { useAdvanceWorkflowAgent } from '../../../../../workflows/useAdvanceWorkflowAgent';
import type { SessionRunVerb } from '../../../../sessionRunsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly verb: SessionRunVerb;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const LABEL = {
  continue: NAMES.continue,
  start: NAMES.start,
} as const satisfies Record<SessionRunVerb['kind'], string>;

export const RunRowVerb = ({ sessionId, verb }: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const advance = useAdvanceWorkflowAgent({ sessionId });
  const pending = usePendingAction({ sessionId });
  const key = `${verb.kind}:${verb.agentId}`;

  const press = (): void => {
    if (verb.kind === 'continue') {
      void pending.run({
        key,
        failureTitle: "Couldn't continue the agent",
        task: () => continueStoppedAgent({ sessionId, agentId: verb.agentId }),
      });
      return;
    }
    void pending.run({
      key,
      failureTitle: "The next step didn't start",
      task: () =>
        advance({ agent: agents.find((candidate) => candidate.id === verb.agentId) ?? null }),
    });
  };

  return (
    <Button variant="quiet" size="xs" isBusy={pending.pendingKeys.has(key)} onClick={press}>
      {LABEL[verb.kind]}
    </Button>
  );
};
