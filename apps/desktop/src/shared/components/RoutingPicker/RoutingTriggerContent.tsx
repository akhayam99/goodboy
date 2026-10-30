import type { ReactNode } from 'react';
import type { ProviderId } from '@goodboy/types';
import { AUTO_LABEL, AutoTriggerLabel } from './AutoTriggerLabel';
import { TriggerLabel } from './TriggerLabel';
import type { RecommendedRouting } from './recommendationSummary';
import type { RoutingTriggerLabel } from './routingSummary';

type Props = {
  readonly resolvedAuto: RecommendedRouting | null;
  readonly isAuto: boolean;
  readonly isPinned: boolean;
  readonly provider: ProviderId;
  readonly label: RoutingTriggerLabel;
  readonly budget: ReactNode;
};

export const RoutingTriggerContent = ({
  resolvedAuto,
  isAuto,
  isPinned,
  provider,
  label,
  budget,
}: Props) => (
  <span className="flex min-w-0 flex-1 items-center gap-2">
    {resolvedAuto?.label != null ? (
      <TriggerLabel
        provider={resolvedAuto.provider}
        label={resolvedAuto.label}
        prefix={AUTO_LABEL}
      />
    ) : isAuto ? (
      <AutoTriggerLabel />
    ) : (
      <TriggerLabel provider={provider} label={label} />
    )}
    {isPinned ? (
      <span data-routing-pinned="" className="shrink-0 text-faint-foreground @max-lg:hidden">
        · pinned
      </span>
    ) : null}
    {budget}
  </span>
);
