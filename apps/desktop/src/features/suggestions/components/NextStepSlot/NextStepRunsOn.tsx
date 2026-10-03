import type { SessionId } from '@goodboy/types';
import { RunsOn } from '../../../../shared/components/RunsOn';
import type { AgentKind, AgentKindRouting } from '../../../session/agent-kind';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';

type Props = {
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
  readonly override: AgentKindRouting | null;
  readonly onChange: (next: AgentKindRouting | null) => void;
  readonly disabled: boolean;
};

export const NextStepRunsOn = ({ sessionId, kind, override, onChange, disabled }: Props) => {
  const suggested = useKindRouting({ sessionId, kind });
  return (
    <RunsOn suggested={suggested} override={override} onChange={onChange} disabled={disabled} />
  );
};
