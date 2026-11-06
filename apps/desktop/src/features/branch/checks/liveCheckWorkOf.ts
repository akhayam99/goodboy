import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { isCheckFixLive } from '../../../store/slices/agents/isCheckFixLive';
import { selectCheckChain } from '../../../store/slices/agents/selectCheckChain';
import {
  selectCheckMount,
  type CheckMountState,
} from '../../../store/slices/agents/selectCheckMount';
import { analyzedCheckNameOf } from './analyzedCheckNameOf';

type State = Parameters<typeof selectCheckChain>[0]['state'] & CheckMountState;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly exceptUrl?: string | null;
};

export type LiveCheckWork = {
  readonly agentId: AgentId;
  readonly chain: 'analyzing' | 'fixing';
  readonly url: string;
  readonly name: string | null;
};

export const liveCheckWorkOf = ({
  state,
  sessionId,
  mountId,
  exceptUrl = null,
}: Params): LiveCheckWork | null => {
  const urls = new Set<string>();
  for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
    const url = agent.sourceCommentUrl;
    if (agent.sourceKind !== 'failed_check' || url === undefined || agent.deletedAt !== undefined) {
      continue;
    }
    if (
      mountId !== null &&
      agent.mountId !== mountId &&
      selectCheckMount({ state, url }) !== mountId
    ) {
      continue;
    }
    urls.add(url);
  }
  for (const url of urls) {
    if (url === exceptUrl) {
      continue;
    }
    const chain = selectCheckChain({ state, sessionId, url });
    if (chain.state !== 'analyzing' && chain.state !== 'fixing') {
      continue;
    }
    const agent = chain.state === 'fixing' ? chain.fix : chain.debugger;
    if (agent === null) {
      continue;
    }
    if (
      chain.state === 'fixing' &&
      !isCheckFixLive({ agent, turn: state.agentTurnState[agent.id] })
    ) {
      continue;
    }
    const name = analyzedCheckNameOf({
      events: chain.debugger === null ? [] : (state.transcripts[chain.debugger.id] ?? []),
    });
    return { agentId: agent.id, chain: chain.state, url, name };
  }
  return null;
};
