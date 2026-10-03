import { FolderMinus, GitBranch, Link2, Link2Off } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SessionEvent, SessionEventKind, SessionEventPayload } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../shared/pullRequestPresentation';

export type SessionEventEmphasis = 'plain' | 'muted' | 'success' | 'merged' | 'danger';

export const SESSION_ARCHIVED_TITLE = 'Session archived';

export const SESSION_RESTORED_TITLE = 'Session restored';

type PullRequestEventKind = Extract<SessionEventKind, `pr_${string}`>;

const PR_EVENT_STATE = {
  pr_created: 'open',
  pr_discovered: 'open',
  pr_ready: 'open',
  pr_approved: 'approved',
  pr_merged: 'merged',
  pr_closed: 'closed',
} satisfies Record<PullRequestEventKind, PullRequestPresentationState>;

const EMPHASIS: Record<SessionEventKind, SessionEventEmphasis> = {
  worktree_created: 'plain',
  branch_created: 'plain',
  branch_switched: 'plain',
  branch_deleted: 'muted',
  branch_restored: 'plain',
  issue_linked: 'plain',
  issue_unlinked: 'muted',
  pr_created: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_created].tone,
  pr_discovered: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_discovered].tone,
  pr_ready: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_ready].tone,
  pr_approved: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_approved].tone,
  pr_merged: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_merged].tone,
  pr_closed: PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_closed].tone,
  workflow_started: 'plain',
  workflow_discarded: 'muted',
  workflow_restored: 'plain',
  workflow_closed: 'muted',
  workflow_deleted: 'muted',
  decisions_changed: 'muted',
  project_materialized: 'plain',
  project_materialization_refused: 'muted',
  project_materialization_proposed: 'plain',
  project_materialization_dismissed: 'muted',
  project_detached: 'muted',
  external_task_created: 'plain',
  rebase_requested: 'muted',
  session_archived: 'muted',
  session_restored: 'plain',
  write_destination_changed: 'plain',
  question_dismissed: 'muted',
  question_restored: 'plain',
  history_rewritten: 'plain',
  history_pushed: 'success',
  history_stopped: 'plain',
  history_restored: 'muted',
};

export type SessionEventGlyph = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

const GLYPH: Record<SessionEventKind, SessionEventGlyph> = {
  worktree_created: {
    icon: CONCEPT_ICONS.worktree,
    tone: CONCEPT_TONE.worktree,
    label: 'Session folder',
  },
  branch_created: { icon: GitBranch, tone: 'info', label: 'Branch' },
  branch_switched: { icon: GitBranch, tone: 'info', label: 'Branch' },
  branch_deleted: { icon: CONCEPT_ICONS.delete, tone: 'neutral', label: 'Branch' },
  branch_restored: { icon: CONCEPT_ICONS.restore, tone: 'info', label: 'Branch' },
  issue_linked: { icon: Link2, tone: 'neutral', label: 'Issue' },
  issue_unlinked: { icon: Link2Off, tone: 'neutral', label: 'Issue' },
  pr_created: { ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_created], label: 'Pull request' },
  pr_discovered: {
    ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_discovered],
    label: 'Pull request',
  },
  pr_ready: { ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_ready], label: 'Pull request' },
  pr_approved: { ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_approved], label: 'Pull request' },
  pr_merged: { ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_merged], label: 'Pull request' },
  pr_closed: { ...PULL_REQUEST_PRESENTATION[PR_EVENT_STATE.pr_closed], label: 'Pull request' },
  workflow_started: { icon: CONCEPT_ICONS.workflows, tone: 'primary', label: 'Workflow' },
  workflow_discarded: { icon: CONCEPT_ICONS.workflows, tone: 'neutral', label: 'Workflow' },
  workflow_restored: { icon: CONCEPT_ICONS.workflows, tone: 'primary', label: 'Workflow' },
  workflow_closed: { icon: CONCEPT_ICONS.workflows, tone: 'neutral', label: 'Workflow' },
  workflow_deleted: { icon: CONCEPT_ICONS.delete, tone: 'neutral', label: 'Workflow' },
  decisions_changed: {
    icon: CONCEPT_ICONS.decisions,
    tone: CONCEPT_TONE.decisions,
    label: 'Context',
  },
  project_materialized: { icon: CONCEPT_ICONS.mount, tone: CONCEPT_TONE.mount, label: 'Project' },
  project_materialization_refused: { icon: CONCEPT_ICONS.mount, tone: 'warning', label: 'Project' },
  project_materialization_proposed: {
    icon: CONCEPT_ICONS.mount,
    tone: CONCEPT_TONE.mount,
    label: 'Project',
  },
  project_materialization_dismissed: { icon: FolderMinus, tone: 'neutral', label: 'Project' },
  project_detached: { icon: FolderMinus, tone: 'neutral', label: 'Project' },
  external_task_created: { icon: Link2, tone: 'neutral', label: 'Issue' },
  rebase_requested: { icon: GitBranch, tone: 'info', label: 'Branch' },
  session_archived: { icon: CONCEPT_ICONS.archive, tone: 'neutral', label: 'Session' },
  session_restored: { icon: CONCEPT_ICONS.restore, tone: 'primary', label: 'Session' },
  write_destination_changed: {
    icon: CONCEPT_ICONS.worktree,
    tone: CONCEPT_TONE.worktree,
    label: 'Write destination',
  },
  question_dismissed: { icon: CONCEPT_ICONS.questions, tone: 'neutral', label: 'Question' },
  question_restored: { icon: CONCEPT_ICONS.questions, tone: 'neutral', label: 'Question' },
  history_rewritten: { icon: CONCEPT_ICONS.history, tone: CONCEPT_TONE.history, label: 'History' },
  history_pushed: { icon: CONCEPT_ICONS.history, tone: 'success', label: 'History' },
  history_stopped: { icon: CONCEPT_ICONS.history, tone: 'warning', label: 'History' },
  history_restored: { icon: CONCEPT_ICONS.history, tone: 'neutral', label: 'History' },
};

type TimelineValueVariant = 'project' | 'branch' | 'path' | 'pull-request' | 'issue' | 'workflow';

export type TimelineLabelSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly text: string; readonly variant: TimelineValueVariant };

type PayloadParams = {
  readonly payload: SessionEventPayload | null;
};

const issueSegments = ({ payload }: PayloadParams): ReadonlyArray<TimelineLabelSegment> => {
  const identifier = payload?.identifier ?? null;
  const title = payload?.title ?? null;
  if (identifier != null && title != null) {
    return [
      { kind: 'value', text: identifier, variant: 'issue' },
      { kind: 'text', text: `: ${title}` },
    ];
  }
  if (identifier != null) {
    return [{ kind: 'value', text: identifier, variant: 'issue' }];
  }
  return [{ kind: 'text', text: title ?? 'an issue' }];
};

const prSegment = ({ payload }: PayloadParams): TimelineLabelSegment =>
  payload?.number == null
    ? { kind: 'text', text: 'Pull request' }
    : { kind: 'value', text: `#${payload.number}`, variant: 'pull-request' };

const workflowSegment = ({ payload }: PayloadParams): TimelineLabelSegment =>
  payload?.workflowName == null
    ? { kind: 'text', text: 'Workflow' }
    : { kind: 'value', text: payload.workflowName, variant: 'workflow' };

type DecisionDiff = {
  readonly additions: number;
  readonly deletions: number;
};

export const decisionDiff = ({ payload }: PayloadParams): DecisionDiff => {
  const replaced = payload?.replaced ?? 0;
  return {
    additions: (payload?.added ?? 0) + replaced + (payload?.restored ?? 0),
    deletions:
      (payload?.removed ?? 0) + replaced + (payload?.withdrawn ?? 0) + (payload?.merged ?? 0),
  };
};

const DECISION_COUNT_WORDS = [
  ['added', 'added'],
  ['replaced', 'replaced'],
  ['removed', 'removed'],
  ['restored', 'restored'],
  ['withdrawn', 'withdrawn'],
  ['merged', 'merged'],
] as const satisfies ReadonlyArray<readonly [keyof SessionEventPayload, string]>;

export const decisionCountsText = ({ payload }: PayloadParams): string | null => {
  const parts = DECISION_COUNT_WORDS.flatMap(([key, word]) => {
    const count = payload?.[key] ?? 0;
    return count > 0 ? [`${count} ${word}`] : [];
  });
  return parts.length === 0 ? null : parts.join(', ');
};

export const isEmptyDecisionDiff = ({ payload }: PayloadParams): boolean => {
  const { additions, deletions } = decisionDiff({ payload });
  return additions === 0 && deletions === 0;
};

const decisionsChangedLabel = ({ payload }: PayloadParams): string =>
  payload?.consolidatedAfter === undefined
    ? 'Context'
    : `Context consolidated after ${payload.consolidatedAfter}`;

type TitleParams = {
  readonly event: SessionEvent;
};

type HistoryEventKind = Extract<SessionEventKind, `history_${string}`>;

const branchSegment = ({ payload }: PayloadParams): TimelineLabelSegment =>
  payload?.branch == null
    ? { kind: 'text', text: 'the branch' }
    : { kind: 'value', text: payload.branch, variant: 'branch' };

const stopDetail = ({ payload }: PayloadParams): string => {
  const files = payload?.files ?? [];
  if (payload?.reason === 'stuck' && files.length > 0) {
    return ` · History rewriter couldn't merge ${files.join(', ')}, it needs you`;
  }
  if (files.length > 0) {
    return ` · conflict in ${files.join(', ')}`;
  }
  return payload?.title == null ? '' : ` · ${payload.title}`;
};

const historyEventLabel = ({
  kind,
  payload,
}: {
  readonly kind: HistoryEventKind;
  readonly payload: SessionEventPayload | null;
}): ReadonlyArray<TimelineLabelSegment> => {
  const isRebase = payload?.origin === 'rebase';
  if (kind === 'history_rewritten') {
    const summary =
      payload?.summary == null || payload.summary === '' ? '' : ` · ${payload.summary}`;
    const code =
      payload?.isTreeEqual === true
        ? ' · same code'
        : payload?.isTreeEqual === false
          ? ' · the code changes'
          : '';
    return isRebase
      ? [
          { kind: 'text', text: 'Rebased ' },
          branchSegment({ payload }),
          { kind: 'text', text: ' on main' },
        ]
      : [
          { kind: 'text', text: 'Rewrote ' },
          branchSegment({ payload }),
          { kind: 'text', text: `${summary}${code}` },
        ];
  }
  if (kind === 'history_pushed') {
    const pr = payload?.prNumber == null ? '' : ` · PR #${payload.prNumber} updated`;
    return [
      { kind: 'text', text: 'Pushed the new history of ' },
      branchSegment({ payload }),
      { kind: 'text', text: pr },
    ];
  }
  if (kind === 'history_stopped') {
    return [
      { kind: 'text', text: isRebase ? 'Rebase of ' : 'Rewrite of ' },
      branchSegment({ payload }),
      { kind: 'text', text: ` stopped${stopDetail({ payload })}` },
    ];
  }
  return [{ kind: 'text', text: 'Restored the previous history of ' }, branchSegment({ payload })];
};

export const sessionEventLabel = ({ event }: TitleParams): ReadonlyArray<TimelineLabelSegment> => {
  const { payload } = event;
  switch (event.kind) {
    case 'worktree_created':
      return payload?.worktreePath == null
        ? [{ kind: 'text', text: 'Session folder created' }]
        : [
            { kind: 'text', text: 'Session folder created at ' },
            { kind: 'value', text: payload.worktreePath, variant: 'path' },
          ];
    case 'branch_created':
      return payload?.branch == null
        ? [{ kind: 'text', text: 'Branch created' }]
        : [
            { kind: 'text', text: 'Branch ' },
            { kind: 'value', text: payload.branch, variant: 'branch' },
            { kind: 'text', text: ' created' },
          ];
    case 'branch_switched':
      return payload?.from == null || payload.to == null
        ? [{ kind: 'text', text: 'Branch switched' }]
        : [
            { kind: 'text', text: 'Branch ' },
            { kind: 'value', text: payload.from, variant: 'branch' },
            { kind: 'text', text: ' → ' },
            { kind: 'value', text: payload.to, variant: 'branch' },
          ];
    case 'branch_deleted':
      return payload?.branch == null
        ? [{ kind: 'text', text: 'Branch deleted' }]
        : [
            { kind: 'text', text: 'Deleted ' },
            { kind: 'value', text: payload.branch, variant: 'branch' },
            {
              kind: 'text',
              text: payload.onOrigin === true ? ' on this Mac and on origin' : ' on this Mac',
            },
          ];
    case 'branch_restored':
      return payload?.branch == null
        ? [{ kind: 'text', text: 'Branch restored' }]
        : [
            { kind: 'text', text: 'Restored ' },
            { kind: 'value', text: payload.branch, variant: 'branch' },
          ];
    case 'issue_linked':
      return [{ kind: 'text', text: 'Linked ' }, ...issueSegments({ payload })];
    case 'issue_unlinked':
      return [{ kind: 'text', text: 'Unlinked ' }, ...issueSegments({ payload })];
    case 'pr_created':
      return payload?.title == null
        ? [{ kind: 'text', text: 'Opened ' }, prSegment({ payload })]
        : [
            { kind: 'text', text: 'Opened ' },
            prSegment({ payload }),
            { kind: 'text', text: `: ${payload.title}` },
          ];
    case 'pr_discovered':
      return payload?.title == null
        ? [{ kind: 'text', text: 'Found ' }, prSegment({ payload })]
        : [
            { kind: 'text', text: 'Found ' },
            prSegment({ payload }),
            { kind: 'text', text: `: ${payload.title}` },
          ];
    case 'pr_ready':
      return [prSegment({ payload }), { kind: 'text', text: ' ready for review' }];
    case 'pr_approved':
      return [prSegment({ payload }), { kind: 'text', text: ' approved' }];
    case 'pr_merged':
      return [prSegment({ payload }), { kind: 'text', text: ' merged' }];
    case 'pr_closed':
      return [prSegment({ payload }), { kind: 'text', text: ' closed' }];
    case 'workflow_started':
      return [workflowSegment({ payload }), { kind: 'text', text: ' started' }];
    case 'workflow_discarded':
      return [workflowSegment({ payload }), { kind: 'text', text: ' discarded' }];
    case 'workflow_restored':
      return [workflowSegment({ payload }), { kind: 'text', text: ' restored' }];
    case 'workflow_closed':
      return [
        { kind: 'text', text: 'Closed ' },
        workflowSegment({ payload }),
        { kind: 'text', text: ' by you' },
      ];
    case 'workflow_deleted':
      return [workflowSegment({ payload }), { kind: 'text', text: ' deleted' }];
    case 'decisions_changed':
      return [{ kind: 'text', text: decisionsChangedLabel({ payload }) }];
    case 'project_materialized': {
      const branch = payload?.branch ?? '';
      const onBranch: ReadonlyArray<TimelineLabelSegment> =
        branch === ''
          ? []
          : [
              { kind: 'text', text: ' on ' },
              { kind: 'value', text: branch, variant: 'branch' },
            ];
      if (payload?.projectName == null) {
        return [{ kind: 'text', text: 'Project added' }, ...onBranch];
      }
      return [
        { kind: 'text', text: 'Added ' },
        { kind: 'value', text: payload.projectName, variant: 'project' },
        ...onBranch,
      ];
    }
    case 'project_materialization_refused': {
      const reason = payload?.reason ?? 'unknown failure';
      if (payload?.projectName == null) {
        return [{ kind: 'text', text: `Couldn't add a project: ${reason}` }];
      }
      return [
        { kind: 'text', text: "Couldn't add " },
        { kind: 'value', text: payload.projectName, variant: 'project' },
        { kind: 'text', text: `: ${reason}` },
      ];
    }
    case 'project_materialization_proposed':
      return payload?.projectName == null
        ? [{ kind: 'text', text: 'Asked to add a project' }]
        : [
            { kind: 'text', text: 'Asked to add ' },
            { kind: 'value', text: payload.projectName, variant: 'project' },
          ];
    case 'project_materialization_dismissed':
      return payload?.projectName == null
        ? [{ kind: 'text', text: 'Declined adding a project' }]
        : [
            { kind: 'text', text: 'Declined adding ' },
            { kind: 'value', text: payload.projectName, variant: 'project' },
          ];
    case 'project_detached':
      return payload?.projectName == null
        ? [{ kind: 'text', text: 'Detached a project' }]
        : [
            { kind: 'text', text: 'Detached ' },
            { kind: 'value', text: payload.projectName, variant: 'project' },
          ];
    case 'external_task_created':
      return [{ kind: 'text', text: 'Created ' }, ...issueSegments({ payload })];
    case 'rebase_requested': {
      const base = payload?.branch ?? null;
      const behind = payload?.behind == null ? '' : ` (${payload.behind} behind)`;
      const onBase: ReadonlyArray<TimelineLabelSegment> =
        base == null
          ? []
          : [
              { kind: 'text', text: ' on ' },
              { kind: 'value', text: base, variant: 'branch' },
              { kind: 'text', text: behind },
            ];
      if (payload?.projectName == null) {
        return [{ kind: 'text', text: 'Rebase started' }, ...onBase];
      }
      return [
        { kind: 'text', text: 'Rebase of ' },
        { kind: 'value', text: payload.projectName, variant: 'project' },
        { kind: 'text', text: ' started' },
        ...onBase,
      ];
    }
    case 'session_archived':
      return [{ kind: 'text', text: SESSION_ARCHIVED_TITLE }];
    case 'session_restored':
      return [{ kind: 'text', text: SESSION_RESTORED_TITLE }];
    case 'write_destination_changed': {
      const branch = payload?.branch ?? '';
      const onBranch: ReadonlyArray<TimelineLabelSegment> =
        branch === ''
          ? []
          : [
              { kind: 'text', text: ' on ' },
              { kind: 'value', text: branch, variant: 'branch' },
            ];
      if (payload?.projectName == null) {
        return [{ kind: 'text', text: 'Write destination changed' }, ...onBranch];
      }
      return [
        { kind: 'text', text: 'Writes now go to ' },
        { kind: 'value', text: payload.projectName, variant: 'project' },
        ...onBranch,
      ];
    }
    case 'question_dismissed':
      return payload?.title == null
        ? [{ kind: 'text', text: 'Question discarded' }]
        : [{ kind: 'text', text: `Question discarded: ${payload.title}` }];
    case 'question_restored':
      return payload?.title == null
        ? [{ kind: 'text', text: 'Question brought back' }]
        : [{ kind: 'text', text: `Question brought back: ${payload.title}` }];
    case 'history_rewritten':
    case 'history_pushed':
    case 'history_stopped':
    case 'history_restored':
      return historyEventLabel({ kind: event.kind, payload });
    default: {
      const exhaustive: never = event.kind;
      return exhaustive;
    }
  }
};

export const TIMELINE_PROJECT_NAME_LIMIT = 3;

type ProjectListParams = {
  readonly names: ReadonlyArray<string>;
  readonly limit: number;
};

const projectListSegments = ({
  names,
  limit,
}: ProjectListParams): ReadonlyArray<TimelineLabelSegment> => {
  const shown = names.length > limit + 1 ? names.slice(0, limit) : names;
  const hidden = names.length - shown.length;
  const segments: TimelineLabelSegment[] = [];
  for (const [index, name] of shown.entries()) {
    if (index > 0) {
      const isLast = index === shown.length - 1 && hidden === 0;
      segments.push({ kind: 'text', text: isLast ? ' and ' : ', ' });
    }
    segments.push({ kind: 'value', text: name, variant: 'project' });
  }
  if (hidden > 0) {
    segments.push({ kind: 'text', text: ` and ${hidden} more` });
  }
  return segments;
};

type ProjectRunParams = {
  readonly mounted: ReadonlyArray<string>;
  readonly detached: ReadonlyArray<string>;
  readonly limit?: number;
};

export const sessionEventProjectRunLabel = ({
  mounted,
  detached,
  limit = TIMELINE_PROJECT_NAME_LIMIT,
}: ProjectRunParams): ReadonlyArray<TimelineLabelSegment> => {
  const mountedSegments: ReadonlyArray<TimelineLabelSegment> =
    mounted.length === 0
      ? []
      : [{ kind: 'text', text: 'Added ' }, ...projectListSegments({ names: mounted, limit })];
  const detachedSegments: ReadonlyArray<TimelineLabelSegment> =
    detached.length === 0
      ? []
      : [
          { kind: 'text', text: mounted.length === 0 ? 'Detached ' : ', detached ' },
          ...projectListSegments({ names: detached, limit }),
        ];
  return [...mountedSegments, ...detachedSegments];
};

export const segmentsToText = ({
  segments,
}: {
  readonly segments: ReadonlyArray<TimelineLabelSegment>;
}): string => segments.map((segment) => segment.text).join('');

export const sessionEventSecondary = ({ event }: TitleParams): string | null => {
  const { payload } = event;
  if (event.kind === 'project_detached') {
    if (payload?.kept !== true) {
      return null;
    }
    return payload.reason ?? 'worktree kept on disk';
  }
  return null;
};

type KindParams = {
  readonly kind: SessionEventKind;
};

export const sessionEventEmphasis = ({ kind }: KindParams): SessionEventEmphasis => EMPHASIS[kind];

export const sessionEventGlyph = ({ kind }: KindParams): SessionEventGlyph => GLYPH[kind];
