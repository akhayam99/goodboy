import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { readLiveWork } from '../../live-state/readLiveWork';
import { workOf } from '../../live-state/workOf';
import { AGENT_KIND_META, classifyAgent } from '../agent-kind';
import type { DoingRun } from './doingAnswerOf';

type Params = {
  readonly sessionId: SessionId;
  readonly getState: () => AppStore;
};

const SOME_AGENT = 'An agent';

export const readDoingRuns = async ({
  sessionId,
  getState,
}: Params): Promise<ReadonlyArray<DoingRun>> => {
  const rows = await readLiveWork({ sessionId });
  const state = getState();
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const work = workOf({
    rows,
    mountNames: new Map(
      (state.sessionProjectMounts[sessionId] ?? []).map((mount) => [
        mount.mountId,
        mount.mountName,
      ]),
    ),
    sessionTitles: new Map([
      [sessionId, sessionTitle({ session: sessionById(state.sessions, sessionId) ?? null })],
    ]),
  });
  return work.map((entry) => {
    const agentId = entry.agentId === null ? null : brandId<AgentId>({ value: entry.agentId });
    const agent = agents.find((candidate) => candidate.id === agentId);
    return {
      agentId,
      agent:
        agent === undefined
          ? SOME_AGENT
          : `The ${AGENT_KIND_META[classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null })].noun}`,
      phrase: entry.phrase,
    };
  });
};
