import { memo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type {
  TimelineDayItem,
  TimelineMoreItem,
  TimelineNowItem,
} from '../../../../timeline/buildTimelineStream';
import { TimelineDayRule } from './TimelineDayRule';
import { TimelineEntryRow, type TimelineEntryRowProps } from './TimelineEntryRow';
import { TimelineMoreRow } from './TimelineMoreRow';
import { TimelineNowRule } from './TimelineNowRule';

type RuleProps = {
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
};

export type TimelineRowProps =
  | (RuleProps & { readonly kind: 'now'; readonly item: TimelineNowItem })
  | (RuleProps & { readonly kind: 'day'; readonly item: TimelineDayItem })
  | (RuleProps & {
      readonly kind: 'more';
      readonly item: TimelineMoreItem;
      readonly onShowAll: (params: { readonly id: string }) => void;
    })
  | (TimelineEntryRowProps & { readonly kind: 'entry' });

const TimelineRowView = (props: TimelineRowProps) => {
  if (props.kind === 'now') {
    return <TimelineNowRule item={props.item} rail={props.rail} railWidth={props.railWidth} />;
  }
  if (props.kind === 'day') {
    return <TimelineDayRule item={props.item} rail={props.rail} railWidth={props.railWidth} />;
  }
  if (props.kind === 'more') {
    return (
      <TimelineMoreRow
        item={props.item}
        rail={props.rail}
        railWidth={props.railWidth}
        onShowAll={props.onShowAll}
      />
    );
  }
  return <TimelineEntryRow {...props} />;
};

export const TimelineRow = memo(TimelineRowView);
