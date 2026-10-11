import { formatUsdPrecise, MetaRow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { useRunTimeLeft } from '../../../../workflows/hooks/useRunTimeLeft';
import type { RunView } from '../useRunView';
import { RunSpendLimitPopover } from '../../../../workflows/components/RunSpendLimitPopover';
import { RunTimeLeftLabel } from '../../../../workflows/components/RunTimeLeftLabel';
import { RunAutonomyMenu } from './RunAutonomyMenu';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countLabel = ({ count, noun }: CountParams): string =>
  `${count} ${count === 1 ? noun : `${noun}s`}`;

export const RunMeta = ({ session, view }: Props) => {
  const { run, workflow, agents, isDiscarded, isDynamic, isCompleted, stepCount } = view;
  const roleModels = useSessionRoleModels({ sessionId: session.id });
  const timeLeft = useRunTimeLeft({
    run,
    steps: workflow.steps,
    agents,
    roleModels,
    sessionProvider: session.providerPreference?.defaultProvider ?? null,
    sessionEffort: session.effort ?? null,
    isShown: !isDiscarded && !isCompleted && run.orchestrationStop == null,
  });
  const isOpen = !isDiscarded && !isCompleted;

  return (
    <MetaRow
      items={[
        stepCount > 0 ? (
          <span className="tabular-nums">
            {isDynamic
              ? countLabel({ count: stepCount, noun: 'step' })
              : `Step ${Math.min(view.doneCount + 1, stepCount)} of ${stepCount}`}
          </span>
        ) : null,
        stepCount > 0 && view.agentCount !== stepCount ? (
          <span className="tabular-nums">
            {countLabel({ count: view.agentCount, noun: 'agent' })}
          </span>
        ) : null,
        <CostBadge value={view.costUsd} title={`${formatUsdPrecise(view.costUsd)} for this run`} />,
        isDynamic && !isDiscarded ? (
          <RunSpendLimitPopover sessionId={session.id} run={run} variant="meta" />
        ) : null,
        isOpen ? <RunAutonomyMenu sessionId={session.id} run={run} /> : null,
        timeLeft === null ? null : <RunTimeLeftLabel timeLeft={timeLeft} />,
      ]}
    />
  );
};
