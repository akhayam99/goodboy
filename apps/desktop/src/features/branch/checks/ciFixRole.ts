import type { Agent } from '@goodboy/types';
import type { AgentKind } from '../../session/agent-kind';

export type CiFixRole = 'analysis' | 'fix';

type Params = {
  readonly agent: Pick<Agent, 'parentAgentId' | 'sourceCommentUrl' | 'sourceKind'>;
  readonly kind: AgentKind;
};

export const ciFixRoleOf = ({ agent, kind }: Params): CiFixRole | null => {
  if (kind === 'ci-debugger') {
    return 'analysis';
  }
  if (kind === 'ci-fixer') {
    return 'fix';
  }
  const isFromCheck = agent.sourceKind === 'failed_check' && agent.sourceCommentUrl !== undefined;
  if (!isFromCheck) {
    return null;
  }
  if (kind === 'debugger' && agent.parentAgentId === undefined) {
    return 'analysis';
  }
  if (kind === 'implementer' && agent.parentAgentId !== undefined) {
    return 'fix';
  }
  return null;
};
