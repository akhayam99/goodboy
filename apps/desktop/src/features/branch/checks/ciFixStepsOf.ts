import type { Agent } from '@goodboy/types';
import type { CheckChain } from '../../../store/slices/agents/selectCheckChain';
import type { CheckOutcome } from './checkOutcomeOf';

export type CiFixStep = {
  readonly name: string;
  readonly agent: Agent | null;
  readonly isRunning: boolean;
  readonly detail: string;
  readonly tone: 'success' | 'warning' | 'danger' | 'neutral';
};

type Params = {
  readonly chain: CheckChain;
  readonly checkName: string | null;
  readonly checkOutcome: CheckOutcome;
};

const CHECK_DETAIL: Readonly<Record<CheckOutcome, string>> = {
  running: 'Running',
  passed: 'Passed',
  failed: 'Still failing',
};

const CHECK_TONE = {
  running: 'warning',
  passed: 'success',
  failed: 'danger',
} as const satisfies Record<CheckOutcome, string>;

type StepParams = {
  readonly chain: CheckChain;
  readonly hasFixLanded: boolean;
};

const firstStepOf = ({ chain, hasFixLanded }: StepParams) => {
  if (chain.state === 'analyzing') {
    return { name: 'Analyze', detail: 'Running', tone: 'warning' as const };
  }
  if (chain.state === 'no-fix' && !chain.isDismissed) {
    return { name: 'Analyze', detail: 'No fix proposed', tone: 'neutral' as const };
  }
  if (hasFixLanded) {
    return { name: 'Analyze', detail: 'Done', tone: 'success' as const };
  }
  if (chain.isDismissed) {
    return { name: 'Proposal', detail: 'Dismissed', tone: 'neutral' as const };
  }
  if (chain.fix === null) {
    return { name: 'Proposal', detail: 'Waiting for you', tone: 'warning' as const };
  }
  return { name: 'Proposal', detail: 'Accepted', tone: 'neutral' as const };
};

const fixStepOf = ({ chain, hasFixLanded }: StepParams) => {
  if (chain.fix === null) {
    return { detail: 'Not started', tone: 'neutral' as const };
  }
  if (hasFixLanded) {
    return { detail: 'Done', tone: 'success' as const };
  }
  if (chain.state === 'fixing') {
    return { detail: 'Running', tone: 'warning' as const };
  }
  return { detail: 'Stopped', tone: 'danger' as const };
};

export const ciFixStepsOf = ({
  chain,
  checkName,
  checkOutcome,
}: Params): ReadonlyArray<CiFixStep> => {
  const isPushed = chain.state === 'fixed-pushed';
  const hasFixLanded = chain.state === 'fixed-local' || isPushed;
  const first = firstStepOf({ chain, hasFixLanded });
  const analysis: CiFixStep = {
    ...first,
    agent: chain.debugger,
    isRunning: chain.state === 'analyzing',
  };
  if (chain.state === 'analyzing' || (chain.state === 'no-fix' && !chain.isDismissed)) {
    return [analysis];
  }
  const fix = fixStepOf({ chain, hasFixLanded });
  const push: ReadonlyArray<CiFixStep> = hasFixLanded
    ? [
        {
          name: 'Push',
          agent: null,
          isRunning: false,
          detail: isPushed ? 'Done' : 'Needs you',
          tone: isPushed ? 'success' : 'warning',
        },
      ]
    : [];
  const check: ReadonlyArray<CiFixStep> = isPushed
    ? [
        {
          name: checkName ?? 'Check',
          agent: null,
          isRunning: checkOutcome === 'running',
          detail: CHECK_DETAIL[checkOutcome],
          tone: CHECK_TONE[checkOutcome],
        },
      ]
    : [];
  return [
    analysis,
    { name: 'Fix', agent: chain.fix, isRunning: chain.state === 'fixing', ...fix },
    ...push,
    ...check,
  ];
};
