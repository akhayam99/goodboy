import { useContext } from 'react';
import { Tooltip, WORK_META_COLUMN, WorkMeta, formatUsd } from '@goodboy/ui';
import { RoutingLabel } from '../../../../../../shared/components/RoutingLabel';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineGroupRoutes } from './TimelineGroupRoutes';
import { TimelineRouting, isProviderGlyphShown } from './timelineRouting';

type Props = {
  readonly totals: GroupTotals | null;
};

export const TimelineGroupMeta = ({ totals }: Props) => {
  const facts = useContext(TimelineRouting);
  if (totals === null) {
    return null;
  }
  const cost = totals.costUsd > 0 ? formatUsd(totals.costUsd) : null;
  const [only] = totals.routes;
  return (
    <WorkMeta
      routing={
        only !== undefined && totals.routes.length === 1 ? (
          <RoutingLabel
            isColumn
            hideGlyph={!isProviderGlyphShown({ facts })}
            provider={only.provider}
            model={only.model}
          />
        ) : totals.routes.length > 1 ? (
          <TimelineGroupRoutes routes={totals.routes} />
        ) : (
          <span aria-hidden className={WORK_META_COLUMN.routing} />
        )
      }
      time={
        totals.time === null ? null : (
          <Tooltip content={totals.time.detail}>
            <span data-testid="work-time">{totals.time.label}</span>
          </Tooltip>
        )
      }
      cost={cost}
    />
  );
};
