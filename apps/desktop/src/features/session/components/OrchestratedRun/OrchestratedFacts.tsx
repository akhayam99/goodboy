import { formatUsd } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useRunSpendUsd } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { RunSpendLimitPopover } from '../../../workflows/components/RunSpendLimitPopover';
import { RunTimeLeftLabel } from '../../../workflows/components/RunTimeLeftLabel';
import { useRunTimeLeft } from '../../../workflows/hooks/useRunTimeLeft';
import type { RunView } from '../AgentTree/useRunView';
import { OrchestratedAutonomyMenu } from './OrchestratedAutonomyMenu';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

const DOT = (
  <span aria-hidden className="text-faint-foreground">
    ·
  </span>
);

export const OrchestratedFacts = ({ session, view }: Props) => {
  const { run, workflow, agents } = view;
  const spentUsd = useRunSpendUsd(session.id, run.id);
  const roleModels = useSessionRoleModels({ sessionId: session.id });
  const timeLeft = useRunTimeLeft({
    run,
    steps: workflow.steps,
    agents,
    roleModels,
    sessionProvider: session.providerPreference?.defaultProvider ?? null,
    sessionEffort: session.effort ?? null,
    isShown: !view.isDiscarded && !view.isCompleted && run.orchestrationStop == null,
  });
  const isOpen = !view.isDiscarded && !view.isCompleted;
  const pool = run.providerPool ?? [];

  return (
    <div
      data-orchestrated-facts=""
      className="flex min-w-0 flex-wrap items-center gap-x-2 text-ui text-muted-foreground"
    >
      {isOpen ? <OrchestratedAutonomyMenu sessionId={session.id} run={run} /> : null}
      {isOpen && pool.length > 0 ? DOT : null}
      {pool.length > 0 ? (
        <span>{`Can use ${pool.map((provider) => PROVIDER_LABEL[provider]).join(', ')}`}</span>
      ) : null}
      {isOpen || pool.length > 0 ? DOT : null}
      <span className="inline-flex items-center gap-1 tabular-nums">
        {view.isDiscarded ? null : (
          <RunSpendLimitPopover sessionId={session.id} run={run} variant="foot" />
        )}
        <span>{`${formatUsd(spentUsd)} spent`}</span>
      </span>
      {timeLeft === null ? null : DOT}
      {timeLeft === null ? null : <RunTimeLeftLabel timeLeft={timeLeft} />}
    </div>
  );
};
