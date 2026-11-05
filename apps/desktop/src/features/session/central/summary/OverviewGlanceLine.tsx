import { StatusDot } from '@goodboy/ui';
import type { OverviewGlance } from '../overviewGlanceOf';

type Props = {
  readonly glance: OverviewGlance;
};

export const OverviewGlanceLine = ({ glance }: Props) => (
  <p
    role="status"
    data-overview-glance={glance.state}
    className="flex min-w-0 items-center gap-2 px-1 text-ui text-foreground"
  >
    <StatusDot tone={glance.tone} size="sm" />
    <span className="min-w-0 truncate">{glance.sentence}</span>
  </p>
);
