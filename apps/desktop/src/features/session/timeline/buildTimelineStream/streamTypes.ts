import type { RowState } from '../../../workTreeModel/rowState';
import type {
  TimelineAgentEntry,
  TimelineArtifactEntry,
  TimelineBranchEntry,
  TimelineEventEntry,
  TimelineIssueEntry,
  TimelineLearningEntry,
  TimelinePlanEntry,
  TimelineQuestionEntry,
  TimelineRunEntry,
} from '../buildTimelineGroups';
import type { RailGroupInput } from '../../../workTreeModel/railGeometry';
import type { RunIdentity } from '../runIdentity';
import type { CiFixStage } from '../../../branch/checks/ciFixStages';
import type { GroupSummary } from '../groupSummary';
import type { TimelineGap, TimelineRowGrade } from '../../../workTreeModel/timelineRhythm';

export type TimelineStreamEntry =
  | TimelineRunEntry
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineArtifactEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineEventEntry
  | TimelineLearningEntry
  | TimelineQuestionEntry;

type StreamRail = {
  readonly id: string;
  readonly height: number;
  readonly topY: number;
  readonly markerY: number | null;
  readonly groupId: string | null;
  readonly isPending: boolean;
  readonly gap: TimelineGap;
};

export type TimelineNowItem = StreamRail & {
  readonly kind: 'now';
  readonly ruleY: number;
};

export type TimelineDayItem = StreamRail & {
  readonly kind: 'day';
  readonly label: string;
  readonly ruleY: number;
};

export type TimelineExplodeSlot = {
  readonly groupId: string;
  readonly kind: 'subagents' | 'steps' | 'outputs';
};

export type TimelineOutputEntry = TimelinePlanEntry | TimelineArtifactEntry | TimelineLearningEntry;

export const outputsExpandId = ({ parentId }: { readonly parentId: string }): string =>
  `outputs:${parentId}`;

export type TimelineRowBranch = {
  readonly expandId: string;
  readonly isExpanded: boolean;
};

export type TimelineRowItem = StreamRail & {
  readonly kind: 'row';
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly ordinal: string | null;
  readonly rowState: RowState;
  readonly hasUnread: boolean;
  readonly explode?: TimelineExplodeSlot;
  readonly branches?: ReadonlyArray<TimelineRowBranch>;
  readonly hasSubagentAttention?: true;
  readonly ciStages?: ReadonlyArray<CiFixStage>;
};

export type TimelineMoreItem = StreamRail & {
  readonly kind: 'more';
  readonly familyId: string | null;
  readonly hiddenCount: number;
  readonly explode: TimelineExplodeSlot;
};

export type TimelineCountItem = StreamRail & {
  readonly kind: 'count';
  readonly familyId: string | null;
  readonly branchKind: TimelineExplodeSlot['kind'];
  readonly identityIndex: number | null;
  readonly expandId: string;
  readonly isExpanded: boolean;
  readonly summary: GroupSummary;
};

export type TimelineStreamItem =
  TimelineNowItem | TimelineDayItem | TimelineRowItem | TimelineMoreItem | TimelineCountItem;

export const countRowIdOf = ({ expandId }: { readonly expandId: string }): string =>
  `count:${expandId}`;

export type TimelineStream = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

export type DraftRow = {
  readonly kind: 'row';
  readonly id: string;
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly groupId: string | null;
  readonly ordinal: string | null;
  readonly sortOrdinal: number;
  readonly rowState: RowState;
  readonly hasUnread: boolean;
  readonly isPending: boolean;
  readonly explode?: TimelineExplodeSlot;
  readonly branches?: ReadonlyArray<TimelineRowBranch>;
  readonly hasSubagentAttention?: true;
  readonly ciStages?: ReadonlyArray<CiFixStage>;
};

type DraftDay = {
  readonly kind: 'day';
  readonly id: string;
  readonly label: string;
};

export type DraftMore = {
  readonly kind: 'more';
  readonly id: string;
  readonly familyId: string | null;
  readonly groupId: string;
  readonly hiddenCount: number;
  readonly explode: TimelineExplodeSlot;
};

export type DraftCount = {
  readonly kind: 'count';
  readonly id: string;
  readonly familyId: string | null;
  readonly branchKind: TimelineExplodeSlot['kind'];
  readonly identityIndex: number | null;
  readonly groupId: string;
  readonly expandId: string;
  readonly isExpanded: boolean;
  readonly summary: GroupSummary;
  readonly slotAt?: string;
};

export type Draft = DraftRow | DraftDay | DraftMore | DraftCount;
