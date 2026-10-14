import type { SessionId } from '@goodboy/types';
import { ciFixRoleOf } from '../../../features/branch/checks/ciFixRole';
import { classifyAgent } from '../../../features/session/agent-kind';
import type { AppState } from '../../types';
import { selectCheckChain, type CheckChainState } from './selectCheckChain';

type Params = {
  readonly state: Pick<
    AppState,
    | 'agentKindOverride'
    | 'agentTurnState'
    | 'checkFixCommits'
    | 'dismissedCheckProposals'
    | 'sessionPhaseRuns'
    | 'transcripts'
  >;
  readonly sessionId: SessionId;
};

export type CiFixKey = {
  readonly agentId: string;
  readonly chainState: CheckChainState;
  readonly isDismissed: boolean;
  readonly isAnalysisFailed: boolean;
  readonly isLatest: boolean;
};

const SEPARATOR = '|';

type FlagParams = {
  readonly isOn: boolean;
};

const flag = ({ isOn }: FlagParams): string => (isOn ? '1' : '0');

export const encodeCiFixKey = ({
  agentId,
  chainState,
  isDismissed,
  isAnalysisFailed,
  isLatest,
}: CiFixKey): string =>
  [
    agentId,
    chainState,
    flag({ isOn: isDismissed }),
    flag({ isOn: isAnalysisFailed }),
    flag({ isOn: isLatest }),
  ].join(SEPARATOR);

const CHAIN_STATES: ReadonlyArray<CheckChainState> = [
  'none',
  'analyzing',
  'proposal',
  'fixing',
  'fixed-local',
  'fixed-pushed',
  'fix-failed',
  'no-fix',
];

type DecodeParams = {
  readonly key: string;
};

export const decodeCiFixKey = ({ key }: DecodeParams): CiFixKey | null => {
  const [agentId, chainState, isDismissed, isAnalysisFailed, isLatest] = key.split(SEPARATOR);
  const state = CHAIN_STATES.find((candidate) => candidate === chainState);
  if (agentId === undefined || state === undefined) {
    return null;
  }
  return {
    agentId,
    chainState: state,
    isDismissed: isDismissed === '1',
    isAnalysisFailed: isAnalysisFailed === '1',
    isLatest: isLatest === '1',
  };
};

export const selectCiFixKeys = ({ state, sessionId }: Params): ReadonlyArray<string> =>
  (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) => {
    if (agent.deletedAt !== undefined || agent.sourceCommentUrl === undefined) {
      return [];
    }
    const kind = classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null });
    if (ciFixRoleOf({ agent, kind }) !== 'analysis') {
      return [];
    }
    if (state.transcripts[agent.id] === undefined) {
      return [];
    }
    const chain = selectCheckChain({ state, sessionId, url: agent.sourceCommentUrl });
    const isLatest = chain.debugger?.id === agent.id;
    return [
      encodeCiFixKey({
        agentId: agent.id,
        chainState: isLatest ? chain.state : 'no-fix',
        isDismissed: isLatest && chain.isDismissed,
        isAnalysisFailed: agent.status === 'failed',
        isLatest,
      }),
    ];
  });
