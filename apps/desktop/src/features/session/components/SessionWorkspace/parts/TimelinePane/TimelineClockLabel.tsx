import { FactCard, Tooltip } from '@goodboy/ui';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { clockCardOf, clockLabelOf } from './timelineClock';

type Props = {
  readonly item: TimelineRowItem;
  readonly at: string | number;
};

export const TimelineClockLabel = ({ item, at }: Props) => {
  const clock = <span>{formatClock({ at })}</span>;
  const card = clockCardOf({ item });
  if (card === null) {
    return <Tooltip content={clockLabelOf({ item })}>{clock}</Tooltip>;
  }
  return <FactCard card={card}>{clock}</FactCard>;
};
