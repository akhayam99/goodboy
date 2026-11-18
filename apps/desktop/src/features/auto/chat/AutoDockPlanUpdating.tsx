import type { ReactNode } from 'react';
import type { AutoDelegation, AutoDelegationState } from '@goodboy/db';
import { Button, tintClasses } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
import { AUTO_PLAN_APPROVE_LABEL } from '../plan/autoPlanApproveLabel';
import { AUTO_STATE_TONE } from './autoStateTone';
import { DelegationClock } from './DelegationClock';

type Props = {
  readonly version: number;
  readonly by: 'lead' | 'planner';
  readonly planner: AutoDelegation | null;
  readonly reason: string;
  readonly openPlan: ReactNode;
  readonly isApproveHidden: boolean;
};

const PLANNER_WORD = {
  accepted: NAMES.queued,
  awaiting_confirm: 'waiting for your go',
  starting: NAMES.starting,
  running: NAMES.running,
  paused: NAMES.paused,
  settled: NAMES.done,
} as const satisfies Readonly<Record<AutoDelegationState, string>>;

export const AutoDockPlanUpdating = ({
  version,
  by,
  planner,
  reason,
  openPlan,
  isApproveHidden,
}: Props) => (
  <div
    data-dock-plan="updating"
    className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
  >
    <span role="status" aria-live="polite" className={tintClasses(AUTO_STATE_TONE.running).text}>
      {`Updating plan v${version} to v${version + 1}`}
    </span>
    <span data-planner-state={planner?.state ?? by} className="text-muted-foreground">
      {by === 'lead'
        ? 'Lead reading your changes'
        : `Planner ${(planner === null ? NAMES.starting : PLANNER_WORD[planner.state]).toLowerCase()}`}
    </span>
    {planner === null ? null : (
      <DelegationClock agentId={planner.childAgentId} isLive={planner.state === 'running'} />
    )}
    <span className="flex-1" />
    <Button variant="quiet" size="xs" disabled title={reason}>
      Ask for changes
    </Button>
    {openPlan}
    {isApproveHidden ? null : (
      <Button variant="primary" size="sm" disabled title={reason}>
        {AUTO_PLAN_APPROVE_LABEL}
      </Button>
    )}
  </div>
);
