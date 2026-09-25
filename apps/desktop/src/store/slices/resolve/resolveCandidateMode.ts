import type { Agent } from '@goodboy/types';

export type ResolveCandidateMode = 'propose' | 'apply';

type WriterParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly resolverId: string;
};

type ModeParams = WriterParams & {
  readonly isOperatorTurn: boolean;
};

export const hasOtherLiveWriter = ({ agents, resolverId }: WriterParams): boolean =>
  agents.some(
    (agent) => agent.id !== resolverId && agent.doneAt == null && agent.status === 'running',
  );

export const resolveCandidateMode = ({
  agents,
  resolverId,
  isOperatorTurn,
}: ModeParams): ResolveCandidateMode =>
  !isOperatorTurn && hasOtherLiveWriter({ agents, resolverId }) ? 'propose' : 'apply';
