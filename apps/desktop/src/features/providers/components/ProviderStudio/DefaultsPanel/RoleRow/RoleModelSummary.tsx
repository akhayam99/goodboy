import type { EffortLevel, ProviderId } from '@goodboy/types';
import { TriggerLabel } from '../../../../../../shared/components/RoutingPicker/TriggerLabel';
import { routingLabelParts } from '../../../../../../shared/components/RoutingPicker/routingSummary';

type Props = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly moreCount: number;
};

export const RoleModelSummary = ({ provider, model, effort, moreCount }: Props) => (
  <span data-role-summary className="inline-flex min-w-0 items-center gap-1.5 text-label">
    <TriggerLabel provider={provider} label={routingLabelParts({ provider, model, effort })} />
    {moreCount > 0 ? <span className="shrink-0 text-faint-foreground">+{moreCount}</span> : null}
  </span>
);
