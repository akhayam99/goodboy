import { Tooltip, WORK_META_COLUMN } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../../../shared/components/RoutingPicker/ProviderGlyph';
import type { GroupRoute } from '../../../../timeline/groupTotals';
import { groupRouteGlyphs } from './groupRouteGlyphs';

type Props = {
  readonly routes: ReadonlyArray<GroupRoute>;
};

export const TimelineGroupRoutes = ({ routes }: Props) => {
  const providers = groupRouteGlyphs({ routes });
  return (
    <Tooltip content={routes.map((route) => route.model ?? route.provider).join(', ')}>
      <span data-meta-column="routing" className={WORK_META_COLUMN.routing}>
        {providers.map((provider) => (
          <ProviderGlyph key={provider} id={provider} size={ICON_SIZE.row} />
        ))}
        <span className={WORK_META_COLUMN.routingName}>{`${routes.length} models`}</span>
      </span>
    </Tooltip>
  );
};
