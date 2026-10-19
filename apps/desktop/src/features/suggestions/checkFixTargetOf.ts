import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { selectCheckChain } from '../../store/slices/agents/selectCheckChain';
import { selectCheckMount } from '../../store/slices/agents/selectCheckMount';

type State = Parameters<typeof selectCheckChain>[0]['state'] &
  Parameters<typeof selectCheckMount>[0]['state'];

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export type CheckFixTarget = {
  readonly url: string;
  readonly fixAgentId: AgentId | undefined;
};

export const checkFixTargetOf = ({ state, sessionId, mountId }: Params): CheckFixTarget | null => {
  const urls = (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) =>
    agent.sourceKind === 'failed_check' &&
    agent.sourceCommentUrl !== undefined &&
    selectCheckMount({ state, url: agent.sourceCommentUrl }) === mountId
      ? [agent.sourceCommentUrl]
      : [],
  );
  const url = urls.at(-1);
  if (url === undefined) {
    return null;
  }
  return { url, fixAgentId: selectCheckChain({ state, sessionId, url }).fix?.id };
};
