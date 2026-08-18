import type { Agent } from '@goodboy/types';
import { formatDuration } from '../../chat/utils/format-duration';
import type {
  TimelineAgentEntry,
  TimelineAnswerEntry,
  TimelineBranchEntry,
  TimelineIssueEntry,
  TimelinePlanEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import { resolveMarkerState, type TimelineMarkerState } from './markerState';
import type { RailGroupInput, RailGroupShape } from './railGeometry';
import type { RunIdentity } from './runIdentity';
import {
  TIMELINE_RHYTHM,
  markerCenterY,
  rowBoxHeight,
  type TimelineGap,
  type TimelineRowGrade,
} from './timelineRhythm';

export type TimelineStreamEntry =
  | TimelineRunEntry
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineAnswerEntry;

export type TimelineVisibility = 'full' | 'summary' | 'folded';

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
  readonly dayKey: string;
  readonly at: string;
  readonly label: string;
  readonly ruleY: number;
  readonly foldedCount: number | null;
};

export type TimelineRowItem = StreamRail & {
  readonly kind: 'row';
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly ordinal: string | null;
  readonly summary: string | null;
  readonly markerState: TimelineMarkerState;
  readonly hasUnread: boolean;
};

export type TimelineClusterItem = StreamRail & {
  readonly kind: 'cluster';
  readonly familyId: string;
  readonly identity: RunIdentity;
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
};

export type TimelineStreamItem =
  TimelineNowItem | TimelineDayItem | TimelineRowItem | TimelineClusterItem;

export type TimelineStream = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly now: Date;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly blockedRunIds: ReadonlySet<string>;
  readonly unfoldedIds: ReadonlySet<string>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
};

type DraftRow = {
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
  readonly summary: string | null;
  readonly markerState: TimelineMarkerState;
  readonly hasUnread: boolean;
  readonly isPending: boolean;
};

type DraftCluster = {
  readonly kind: 'cluster';
  readonly id: string;
  readonly familyId: string;
  readonly identity: RunIdentity;
  readonly groupId: string;
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
};

type DraftDay = {
  readonly kind: 'day';
  readonly id: string;
  readonly dayKey: string;
  readonly at: string;
  readonly label: string;
  readonly sortOrdinal: number;
  readonly foldedCount: number | null;
};

type Draft = DraftRow | DraftCluster | DraftDay;

const laneIdOf = ({ entryId }: { readonly entryId: string }): string => `lane:${entryId}`;

const startOfDay = ({ date }: { readonly date: Date }): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dayKeyOf = ({ at }: { readonly at: string }): string => new Date(at).toDateString();

const endOfDayOf = ({ at }: { readonly at: string }): string =>
  new Date(startOfDay({ date: new Date(at) }) + 24 * 60 * 60 * 1000 - 1).toISOString();

type Sortable = {
  readonly at: string | null;
  readonly sortOrdinal: number;
  readonly id: string;
};

const compareNewestFirst = ({
  first,
  second,
}: {
  readonly first: Sortable;
  readonly second: Sortable;
}): number => {
  if (first.at != null && second.at != null && first.at !== second.at) {
    return second.at.localeCompare(first.at);
  }
  if (first.at == null && second.at != null) {
    return -1;
  }
  if (first.at != null && second.at == null) {
    return 1;
  }
  return second.sortOrdinal - first.sortOrdinal || first.id.localeCompare(second.id);
};

const dayRankOf = ({ at, now }: { readonly at: string; readonly now: Date }): number =>
  Math.round(
    (startOfDay({ date: now }) - startOfDay({ date: new Date(at) })) / (24 * 60 * 60 * 1000),
  );

const stepAgentsOf = ({ entry }: { readonly entry: TimelineRunEntry }): ReadonlyArray<Agent> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : []));

const isSettled = ({ agent }: { readonly agent: Agent }): boolean =>
  agent.status === 'completed' || agent.status === 'skipped';

const isRunFinished = ({ entry }: { readonly entry: TimelineRunEntry }): boolean => {
  const steps = stepAgentsOf({ entry });
  if (steps.length === 0) {
    return entry.run.discardedAt != null;
  }
  return steps.every((agent) => isSettled({ agent }));
};

type AgentTreeParams = {
  readonly entry: TimelineAgentEntry;
};

const agentTreeAgents = ({ entry }: AgentTreeParams): ReadonlyArray<Agent> => [
  entry.agent,
  ...entry.children.flatMap((child) => agentTreeAgents({ entry: child })),
];

type NewestParams = {
  readonly entry: TimelineTopLevelEntry;
};

const newestInstantOf = ({ entry }: NewestParams): string | null => {
  if (entry.kind !== 'run') {
    return entry.at;
  }
  const instants = entry.children.flatMap((child) => (child.at == null ? [] : [child.at]));
  return instants.reduce<string | null>(
    (newest, value) => (newest == null || value > newest ? value : newest),
    entry.at,
  );
};

type SummaryParams = {
  readonly entry: TimelineRunEntry;
};

const summaryOf = ({ entry }: SummaryParams): string => {
  const steps = stepAgentsOf({ entry });
  const started = steps.flatMap((agent) => (agent.startedAt == null ? [] : [agent.startedAt]));
  const finished = steps.flatMap((agent) => (agent.completedAt == null ? [] : [agent.completedAt]));
  const first = started.reduce<string | null>(
    (earliest, value) => (earliest == null || value < earliest ? value : earliest),
    null,
  );
  const last = finished.reduce<string | null>(
    (latest, value) => (latest == null || value > latest ? value : latest),
    null,
  );
  const stepLabel = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`;
  if (first == null || last == null) {
    return stepLabel;
  }
  const durationMs = Math.max(0, new Date(last).getTime() - new Date(first).getTime());
  return `${stepLabel} · ${formatDuration({ durationMs })}`;
};

type EmitContext = {
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly blockedRunIds: ReadonlySet<string>;
  readonly drafts: Draft[];
  readonly groups: RailGroupInput[];
};

type EmitAgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly grade: TimelineRowGrade;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly groupId: string | null;
  readonly context: EmitContext;
};

const emitAgent = ({
  entry,
  grade,
  identity,
  familyId,
  groupId,
  context,
}: EmitAgentParams): void => {
  const childLaneId = laneIdOf({ entryId: entry.id });
  const hasChildren = entry.children.length > 0;
  if (hasChildren) {
    context.groups.push({
      id: childLaneId,
      parentGroupId: groupId,
      identityIndex: identity?.index ?? 0,
      originRowId: entry.id,
      shape: entry.children.every((child) => isSettled({ agent: child.agent })) ? 'merged' : 'open',
    });
    for (const child of entry.children) {
      emitAgent({
        entry: child,
        grade: 'step',
        identity,
        familyId,
        groupId: childLaneId,
        context,
      });
    }
  }
  for (const answer of entry.answers) {
    context.drafts.push({
      kind: 'row',
      id: answer.id,
      at: answer.at,
      grade: 'step',
      entry: answer,
      identity,
      familyId,
      groupId,
      ordinal: null,
      sortOrdinal: 0,
      summary: null,
      markerState: 'done',
      hasUnread: false,
      isPending: false,
    });
  }
  const hasUnread = context.unreadAgentIds.has(entry.agent.id);
  context.drafts.push({
    kind: 'row',
    id: entry.id,
    at: entry.at,
    grade,
    entry,
    identity,
    familyId,
    groupId,
    ordinal: entry.stepLabel,
    sortOrdinal: entry.ordinal,
    summary: null,
    markerState: resolveMarkerState({
      status: entry.agent.status,
      hasOpenQuestion: entry.openQuestions.length > 0,
      needsUser: false,
    }),
    hasUnread,
    isPending: entry.agent.status === 'pending',
  });
};

type EmitRunParams = {
  readonly entry: TimelineRunEntry;
  readonly visibility: TimelineVisibility;
  readonly context: EmitContext;
};

const emitRun = ({ entry, visibility, context }: EmitRunParams): void => {
  const laneId = laneIdOf({ entryId: entry.id });
  const isFinished = isRunFinished({ entry });
  const needsUser = context.blockedRunIds.has(entry.run.id);
  const shape: RailGroupShape =
    visibility === 'summary' ? 'collapsed' : isFinished ? 'merged' : 'open';
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    identityIndex: entry.identity.index,
    originRowId: entry.id,
    shape,
  });
  if (visibility === 'full') {
    for (const child of entry.children) {
      if (child.kind === 'agent') {
        emitAgent({
          entry: child,
          grade: 'step',
          identity: entry.identity,
          familyId: entry.id,
          groupId: laneId,
          context,
        });
        continue;
      }
      context.drafts.push({
        kind: 'row',
        id: child.id,
        at: child.at,
        grade: 'step',
        entry: child,
        identity: entry.identity,
        familyId: entry.id,
        groupId: laneId,
        ordinal: null,
        sortOrdinal: 0,
        summary: null,
        markerState: 'done',
        hasUnread: false,
        isPending: false,
      });
    }
  }
  const steps = stepAgentsOf({ entry });
  context.drafts.push({
    kind: 'row',
    id: entry.id,
    at: entry.at,
    grade: 'entry',
    entry,
    identity: entry.identity,
    familyId: entry.id,
    groupId: null,
    ordinal: null,
    sortOrdinal: 0,
    summary: visibility === 'summary' ? summaryOf({ entry }) : null,
    markerState: resolveMarkerState({
      status: steps.some((agent) => agent.status === 'running')
        ? 'running'
        : steps.some((agent) => agent.status === 'failed')
          ? 'failed'
          : isFinished
            ? 'completed'
            : 'pending',
      hasOpenQuestion: false,
      needsUser,
    }),
    hasUnread: steps.some((agent) => context.unreadAgentIds.has(agent.id)),
    isPending: false,
  });
};

type ClusterParams = {
  readonly drafts: ReadonlyArray<Draft>;
};

const withPendingClusters = ({ drafts }: ClusterParams): ReadonlyArray<Draft> => {
  const clustered: Draft[] = [];
  let run: DraftRow[] = [];
  const flush = () => {
    const first = run[0];
    if (first === undefined) {
      return;
    }
    if (run.length < 2 || first.groupId == null || first.identity == null) {
      clustered.push(...run);
      run = [];
      return;
    }
    clustered.push({
      kind: 'cluster',
      id: `cluster:${first.id}`,
      familyId: first.familyId ?? first.id,
      identity: first.identity,
      groupId: first.groupId,
      steps: run.flatMap((draft) => (draft.entry.kind === 'agent' ? [draft.entry] : [])),
    });
    run = [];
  };

  for (const draft of drafts) {
    const isPendingStep =
      draft.kind === 'row' && draft.grade === 'step' && draft.markerState === 'pending';
    if (!isPendingStep) {
      flush();
      clustered.push(draft);
      continue;
    }
    const previous = run[0];
    if (previous !== undefined && previous.groupId !== draft.groupId) {
      flush();
    }
    run.push(draft);
  }
  flush();
  return clustered;
};

type DayBreakParams = {
  readonly drafts: ReadonlyArray<Draft>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
  readonly foldedCountByDay: ReadonlyMap<string, number>;
};

const withDayBreaks = ({
  drafts,
  dayLabelFor,
  foldedCountByDay,
}: DayBreakParams): ReadonlyArray<Draft> => {
  const dated: Draft[] = [];
  const seen = new Set(drafts.flatMap((draft) => (draft.kind === 'day' ? [draft.dayKey] : [])));
  let previousDayKey: string | null = null;

  for (const draft of drafts) {
    if (draft.kind === 'day') {
      previousDayKey = draft.dayKey;
      dated.push(draft);
      continue;
    }
    const at = draft.kind === 'row' ? draft.at : null;
    if (at == null) {
      dated.push(draft);
      continue;
    }
    const dayKey = dayKeyOf({ at });
    const label = dayLabelFor({ at });
    if (dayKey !== previousDayKey && label != null && !seen.has(dayKey)) {
      seen.add(dayKey);
      dated.push({
        kind: 'day',
        id: `day:${dayKey}`,
        dayKey,
        at,
        label,
        sortOrdinal: Number.MAX_SAFE_INTEGER,
        foldedCount: foldedCountByDay.get(dayKey) ?? null,
      });
    }
    previousDayKey = dayKey;
    dated.push(draft);
  }

  return dated;
};

export const buildTimelineStream = ({
  entries,
  now,
  unreadAgentIds,
  blockedRunIds,
  unfoldedIds,
  dayLabelFor,
}: Params): TimelineStream => {
  const context: EmitContext = {
    unreadAgentIds,
    blockedRunIds,
    drafts: [],
    groups: [],
  };

  const visibilityOf = ({ entry }: { readonly entry: TimelineTopLevelEntry }) => {
    if (unfoldedIds.has(entry.id)) {
      return 'full' as const;
    }
    const agents =
      entry.kind === 'run'
        ? entry.children.flatMap((child) =>
            child.kind === 'agent' ? agentTreeAgents({ entry: child }) : [],
          )
        : entry.kind === 'agent'
          ? agentTreeAgents({ entry })
          : [];
    const isUnfinished =
      entry.kind === 'run'
        ? !isRunFinished({ entry })
        : agents.some((agent) => !isSettled({ agent }) || agent.status === 'failed');
    const isUnseen = agents.some((agent) => unreadAgentIds.has(agent.id));
    if (isUnfinished || isUnseen) {
      return 'full' as const;
    }
    const newest = newestInstantOf({ entry });
    if (newest == null) {
      return 'full' as const;
    }
    const rank = dayRankOf({ at: newest, now });
    if (rank <= 0) {
      return 'full' as const;
    }
    if (rank === 1) {
      return entry.kind === 'run' ? ('summary' as const) : ('full' as const);
    }
    return unfoldedIds.has(dayKeyOf({ at: newest })) ? ('full' as const) : ('folded' as const);
  };

  const foldedCountByDay = new Map<string, number>();
  const foldedDayInstants = new Map<string, string>();

  for (const entry of entries) {
    const visibility = visibilityOf({ entry });
    const newest = newestInstantOf({ entry }) ?? entry.at;
    if (visibility === 'folded' && newest != null) {
      const dayKey = dayKeyOf({ at: newest });
      foldedCountByDay.set(dayKey, (foldedCountByDay.get(dayKey) ?? 0) + 1);
      foldedDayInstants.set(dayKey, endOfDayOf({ at: newest }));
      continue;
    }
    if (entry.kind === 'run') {
      emitRun({ entry, visibility, context });
      continue;
    }
    if (entry.kind === 'agent') {
      emitAgent({
        entry,
        grade: 'entry',
        identity: null,
        familyId: entry.id,
        groupId: null,
        context,
      });
      continue;
    }
    context.drafts.push({
      kind: 'row',
      id: entry.id,
      at: entry.at,
      grade: 'entry',
      entry,
      identity: null,
      familyId: null,
      groupId: null,
      ordinal: null,
      sortOrdinal: 0,
      summary: null,
      markerState: 'done',
      hasUnread: false,
      isPending: false,
    });
  }

  for (const [dayKey, at] of foldedDayInstants) {
    context.drafts.push({
      kind: 'day',
      id: `day:${dayKey}`,
      dayKey,
      at,
      label: dayLabelFor({ at }) ?? dayKey,
      sortOrdinal: Number.MAX_SAFE_INTEGER,
      foldedCount: foldedCountByDay.get(dayKey) ?? 0,
    });
  }

  const sorted = [...context.drafts].sort((first, second) => compareNewestFirst({ first, second }));
  const withDays = withDayBreaks({
    drafts: withPendingClusters({ drafts: sorted }),
    dayLabelFor,
    foldedCountByDay,
  });

  const items: TimelineStreamItem[] = [
    {
      kind: 'now',
      id: 'now',
      height: TIMELINE_RHYTHM.now.height,
      topY: TIMELINE_RHYTHM.now.ruleY,
      ruleY: TIMELINE_RHYTHM.now.ruleY,
      markerY: null,
      groupId: null,
      isPending: false,
      gap: 'none',
    },
  ];

  let previous: Draft | null = null;
  for (const draft of withDays) {
    if (draft.kind === 'day') {
      items.push({
        kind: 'day',
        id: draft.id,
        dayKey: draft.dayKey,
        at: draft.at,
        label: draft.label,
        height: TIMELINE_RHYTHM.day.height,
        topY: 0,
        ruleY: TIMELINE_RHYTHM.day.ruleY,
        markerY: TIMELINE_RHYTHM.day.ruleY,
        groupId: null,
        isPending: false,
        gap: 'none',
        foldedCount: draft.foldedCount,
      });
      previous = draft;
      continue;
    }
    const { familyId } = draft;
    const gap: TimelineGap =
      previous == null || previous.kind === 'day'
        ? 'none'
        : familyId != null &&
            (previous.kind === 'cluster' || previous.kind === 'row') &&
            previous.familyId === familyId
          ? 'sibling'
          : 'entry';
    if (draft.kind === 'cluster') {
      const height =
        TIMELINE_RHYTHM.gap[gap] + TIMELINE_RHYTHM.grade.pending.height * draft.steps.length;
      items.push({
        kind: 'cluster',
        id: draft.id,
        familyId: draft.familyId,
        identity: draft.identity,
        steps: draft.steps,
        height,
        topY: 0,
        markerY: (TIMELINE_RHYTHM.gap[gap] + height) / 2,
        groupId: draft.groupId,
        isPending: true,
        gap,
      });
      previous = draft;
      continue;
    }
    items.push({
      kind: 'row',
      id: draft.id,
      at: draft.at,
      grade: draft.grade,
      entry: draft.entry,
      identity: draft.identity,
      familyId: draft.familyId,
      ordinal: draft.ordinal,
      summary: draft.summary,
      markerState: draft.markerState,
      hasUnread: draft.hasUnread,
      height: rowBoxHeight({ grade: draft.grade, gap }),
      topY: 0,
      markerY: markerCenterY({ grade: draft.grade, gap }),
      groupId: draft.groupId,
      isPending: draft.isPending,
      gap,
    });
    previous = draft;
  }

  const rowIds = new Set(items.map((item) => item.id));
  return {
    items,
    groups: context.groups.filter((group) => rowIds.has(group.originRowId)),
  };
};
