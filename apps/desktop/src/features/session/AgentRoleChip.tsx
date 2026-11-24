import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { AgentKindChip } from '../../shared/components/AgentKindChip';
import type { AgentKind } from './agent-kind';
import { AgentRoleChipCard } from './AgentRoleChipCard';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly kind: AgentKind;
  readonly position: string;
  readonly costUsd: number;
  readonly isCardOpen?: boolean;
  readonly onClick?: () => void;
};

export const AgentRoleChip = ({
  sessionId,
  agentId,
  kind,
  position,
  costUsd,
  isCardOpen = false,
  onClick,
}: Props) => {
  const agent = useAppStore(
    (state) =>
      state.sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId) ?? null,
  );
  if (agent === null) {
    return <AgentKindChip kind={kind} density="glyph" className="self-center" />;
  }
  return (
    <AgentRoleChipCard
      agent={agent}
      kind={kind}
      position={position}
      costUsd={costUsd}
      isOpen={isCardOpen}
      onClick={onClick}
    />
  );
};
