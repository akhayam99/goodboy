import {
  FolderPlus,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Link2,
  Link2Off,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SessionEvent, SessionEventKind, SessionEventPayload } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

export type SessionEventEmphasis = 'plain' | 'muted' | 'success';

const EMPHASIS: Record<SessionEventKind, SessionEventEmphasis> = {
  worktree_created: 'plain',
  branch_created: 'plain',
  branch_switched: 'plain',
  issue_linked: 'plain',
  issue_unlinked: 'muted',
  pr_created: 'plain',
  pr_ready: 'plain',
  pr_approved: 'success',
  pr_merged: 'success',
  pr_closed: 'muted',
  workflow_started: 'plain',
  workflow_discarded: 'muted',
  workflow_restored: 'plain',
  workflow_deleted: 'muted',
  decisions_changed: 'muted',
};

export type SessionEventGlyph = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

const GLYPH: Record<SessionEventKind, SessionEventGlyph> = {
  worktree_created: { icon: FolderPlus, tone: 'neutral', label: 'Worktree' },
  branch_created: { icon: GitBranch, tone: 'info', label: 'Branch' },
  branch_switched: { icon: GitBranch, tone: 'info', label: 'Branch' },
  issue_linked: { icon: Link2, tone: 'neutral', label: 'Issue' },
  issue_unlinked: { icon: Link2Off, tone: 'neutral', label: 'Issue' },
  pr_created: { icon: GitPullRequest, tone: 'primary', label: 'Pull request' },
  pr_ready: { icon: GitPullRequest, tone: 'primary', label: 'Pull request' },
  pr_approved: { icon: CONCEPT_ICONS.checks, tone: 'success', label: 'Pull request' },
  pr_merged: { icon: GitMerge, tone: 'success', label: 'Pull request' },
  pr_closed: { icon: GitPullRequestClosed, tone: 'neutral', label: 'Pull request' },
  workflow_started: { icon: CONCEPT_ICONS.workflows, tone: 'accent', label: 'Workflow' },
  workflow_discarded: { icon: CONCEPT_ICONS.workflows, tone: 'neutral', label: 'Workflow' },
  workflow_restored: { icon: CONCEPT_ICONS.workflows, tone: 'accent', label: 'Workflow' },
  workflow_deleted: { icon: Trash2, tone: 'neutral', label: 'Workflow' },
  decisions_changed: { icon: CONCEPT_ICONS.decisions, tone: 'neutral', label: 'Decisions' },
};

type PayloadParams = {
  readonly payload: SessionEventPayload | null;
};

const issueLabel = ({ payload }: PayloadParams): string => {
  const identifier = payload?.identifier ?? null;
  const title = payload?.title ?? null;
  if (identifier != null && title != null) {
    return `${identifier}: ${title}`;
  }
  return identifier ?? title ?? 'an issue';
};

const prLabel = ({ payload }: PayloadParams): string =>
  payload?.number == null ? 'Pull request' : `#${payload.number}`;

const workflowLabel = ({ payload }: PayloadParams): string => payload?.workflowName ?? 'Workflow';

const decisionCount = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 decision' : `${count} decisions`;

type TitleParams = {
  readonly event: SessionEvent;
};

export const sessionEventTitle = ({ event }: TitleParams): string => {
  const { payload } = event;
  switch (event.kind) {
    case 'worktree_created':
      return payload?.worktreePath ?? 'Worktree created';
    case 'branch_created':
      return payload?.branch == null ? 'Branch created' : `Branch created: ${payload.branch}`;
    case 'branch_switched':
      return payload?.from == null || payload.to == null
        ? 'Branch switched'
        : `Branch switched: ${payload.from} → ${payload.to}`;
    case 'issue_linked':
      return `Linked ${issueLabel({ payload })}`;
    case 'issue_unlinked':
      return `Unlinked ${issueLabel({ payload })}`;
    case 'pr_created':
      return payload?.title == null
        ? `Opened ${prLabel({ payload })}`
        : `Opened ${prLabel({ payload })}: ${payload.title}`;
    case 'pr_ready':
      return `${prLabel({ payload })} ready for review`;
    case 'pr_approved':
      return `${prLabel({ payload })} approved`;
    case 'pr_merged':
      return `${prLabel({ payload })} merged`;
    case 'pr_closed':
      return `${prLabel({ payload })} closed`;
    case 'workflow_started':
      return `${workflowLabel({ payload })} started`;
    case 'workflow_discarded':
      return `${workflowLabel({ payload })} discarded`;
    case 'workflow_restored':
      return `${workflowLabel({ payload })} restored`;
    case 'workflow_deleted':
      return `${workflowLabel({ payload })} deleted`;
    case 'decisions_changed':
      return `${decisionCount({ count: payload?.added ?? 0 })} added, ${payload?.removed ?? 0} removed`;
    default: {
      const exhaustive: never = event.kind;
      return exhaustive;
    }
  }
};

type KindParams = {
  readonly kind: SessionEventKind;
};

export const sessionEventEmphasis = ({ kind }: KindParams): SessionEventEmphasis => EMPHASIS[kind];

export const sessionEventGlyph = ({ kind }: KindParams): SessionEventGlyph => GLYPH[kind];
