import { useRef, useState } from 'react';
import { Band, formatError } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AgentKind } from '../../agent-kind';
import { useAutoMembership } from '../../../auto/useAutoMembership';
import { agentFollowUpMoves } from '../../followUpMoves';
import { continueWithRole } from '../../startRun/continueWithRole';
import type { FollowUpChild } from './followUpChildren';
import { AgentFollowUpChild } from './AgentFollowUpChild';
import { AgentFollowUpMove } from './AgentFollowUpMove';

type Props = {
  readonly sourceAgent: Agent;
  readonly sourceKind: AgentKind;
  readonly sessionId: SessionId;
  readonly followUps: ReadonlyArray<FollowUpChild>;
};

type ContinueParams = {
  readonly kind: AgentKind;
  readonly hint: string;
};

export const AgentFollowUps = ({ sourceAgent, sourceKind, sessionId, followUps }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const membership = useAutoMembership({ sessionId, agentId: sourceAgent.id });
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<AgentKind | null>(null);
  const busyRef = useRef(false);

  const moves = agentFollowUpMoves({ sourceKind, isInAutoTree: membership.isMember });
  if (moves.length === 0) {
    return null;
  }
  if (sourceAgent.status !== 'completed') {
    return null;
  }
  if (sourceAgent.workflowRunId != null) {
    return null;
  }

  const spawnedKinds = new Set(followUps.map((entry) => entry.kind));
  const pending = moves.filter((move) => !spawnedKinds.has(move.kind));

  const onContinue = async ({ kind, hint }: ContinueParams): Promise<void> => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusyKind(kind);
    setError(null);
    try {
      const outcome = await continueWithRole({
        sessionId,
        role: kind,
        work: hint,
        sourceAgentId: sourceAgent.id,
      });
      navigate({ to: agentPlace({ sessionId, agentId: outcome.agentId }) });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      busyRef.current = false;
      setBusyKind(null);
    }
  };

  return (
    <Band
      inset="content"
      label="Continue"
      hint={
        pending.length > 0
          ? "Auto picks it up from this agent's work."
          : "Follow-ups already picked up this agent's output."
      }
    >
      <div className="flex flex-col gap-2">
        {followUps.map((entry) => (
          <AgentFollowUpChild key={entry.child.agent.id} entry={entry} sessionId={sessionId} />
        ))}
        {pending.map((move) => (
          <AgentFollowUpMove
            key={move.kind}
            kind={move.kind}
            label={move.label}
            hint={move.hint}
            isBusy={busyKind === move.kind}
            isDisabled={busyKind !== null}
            onContinue={() => void onContinue({ kind: move.kind, hint: move.hint })}
          />
        ))}
        {error === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
      </div>
    </Band>
  );
};
