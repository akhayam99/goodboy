import type { CheckChain } from '../../../store/slices/agents/selectCheckChain';

type CiFixStageId = 'analyze' | 'fix' | 'push';

export type CiFixStageStatus = 'wait' | 'run' | 'done' | 'need' | 'failed';

export type CiFixStage = {
  readonly id: CiFixStageId;
  readonly label: string;
  readonly status: CiFixStageStatus;
};

type CiFixPhase = 'running' | 'waiting' | 'failed' | 'done';

export type CiFixProgress = {
  readonly stages: ReadonlyArray<CiFixStage>;
  readonly word: string;
  readonly phase: CiFixPhase;
};

type Params = {
  readonly chain: Pick<CheckChain, 'state' | 'isDismissed'>;
  readonly isAnalysisFailed: boolean;
};

const ANALYZE_DONE: CiFixStage = { id: 'analyze', label: 'Analyze', status: 'done' };

export const ciFixProgressOf = ({ chain, isAnalysisFailed }: Params): CiFixProgress => {
  if (
    isAnalysisFailed &&
    chain.state !== 'fixing' &&
    chain.state !== 'fixed-local' &&
    chain.state !== 'fixed-pushed'
  ) {
    return {
      stages: [{ id: 'analyze', label: 'Analyze', status: 'failed' }],
      word: 'Analysis stopped',
      phase: 'failed',
    };
  }
  switch (chain.state) {
    case 'none':
    case 'analyzing':
      return {
        stages: [
          { id: 'analyze', label: 'Analyze', status: 'run' },
          { id: 'fix', label: 'Fix', status: 'wait' },
        ],
        word: 'Analyzing',
        phase: 'running',
      };
    case 'proposal':
      return {
        stages: [ANALYZE_DONE, { id: 'fix', label: 'Fix', status: 'need' }],
        word: 'Fix proposed',
        phase: 'waiting',
      };
    case 'no-fix':
      return {
        stages: [ANALYZE_DONE],
        word: chain.isDismissed ? 'Dismissed' : 'No fix proposed',
        phase: 'done',
      };
    case 'fixing':
      return {
        stages: [ANALYZE_DONE, { id: 'fix', label: 'Fix', status: 'run' }],
        word: 'Fixing',
        phase: 'running',
      };
    case 'fixed-pushed':
      return {
        stages: [
          ANALYZE_DONE,
          { id: 'fix', label: 'Fix', status: 'done' },
          { id: 'push', label: 'Push', status: 'done' },
        ],
        word: 'Pushed',
        phase: 'done',
      };
    case 'fixed-local':
      return {
        stages: [
          ANALYZE_DONE,
          { id: 'fix', label: 'Fix', status: 'done' },
          { id: 'push', label: 'Push', status: 'need' },
        ],
        word: 'Ready to push',
        phase: 'waiting',
      };
    case 'fix-failed':
      return {
        stages: [ANALYZE_DONE, { id: 'fix', label: 'Fix', status: 'failed' }],
        word: 'Fix stopped',
        phase: 'failed',
      };
    default: {
      const exhaustive: never = chain.state;
      return exhaustive;
    }
  }
};
