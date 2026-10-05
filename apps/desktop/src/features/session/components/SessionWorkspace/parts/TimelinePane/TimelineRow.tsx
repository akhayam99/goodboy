import { memo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type {
  TimelineCountItem,
  TimelineDayItem,
  TimelineMoreItem,
  TimelineNowItem,
} from '../../../../timeline/buildTimelineStream';
import { TimelineCountRow } from './TimelineCountRow';
import { TimelineDayRule } from './TimelineDayRule';
import { TimelineEntryRow, type TimelineEntryRowProps } from './TimelineEntryRow';
import { TimelineMoreRow } from './TimelineMoreRow';
import { TimelineNowRule } from './TimelineNowRule';
import type { TimelineLaneControl } from './TimelineRail';

type RuleProps = {
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly lanes: TimelineLaneControl | null;
};

export type TimelineRowProps =
  | (RuleProps & { readonly kind: 'now'; readonly item: TimelineNowItem })
  | (RuleProps & { readonly kind: 'day'; readonly item: TimelineDayItem })
  | (RuleProps & {
      readonly kind: 'more';
      readonly item: TimelineMoreItem;
      readonly onShowAll: (params: { readonly id: string }) => void;
    })
  | (RuleProps & {
      readonly kind: 'count';
      readonly item: TimelineCountItem;
      readonly isExpanded: boolean;
      readonly onSet: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
    })
  | (TimelineEntryRowProps & { readonly kind: 'entry' });

const TimelineRowView = (props: TimelineRowProps) => {
  if (props.kind === 'now') {
    return (
      <TimelineNowRule
        item={props.item}
        rail={props.rail}
        railWidth={props.railWidth}
        lanes={props.lanes}
      />
    );
  }
  if (props.kind === 'day') {
    return (
      <TimelineDayRule
        item={props.item}
        rail={props.rail}
        railWidth={props.railWidth}
        lanes={props.lanes}
      />
    );
  }
  if (props.kind === 'more') {
    return (
      <TimelineMoreRow
        item={props.item}
        rail={props.rail}
        railWidth={props.railWidth}
        lanes={props.lanes}
        onShowAll={props.onShowAll}
      />
    );
  }
  if (props.kind === 'count') {
    return (
      <TimelineCountRow
        item={props.item}
        rail={props.rail}
        railWidth={props.railWidth}
        lanes={props.lanes}
        isExpanded={props.isExpanded}
        onSet={props.onSet}
      />
    );
  }
  return <TimelineEntryRow {...props} />;
};

export const TimelineRow = memo(TimelineRowView);
