import type { SessionEventKind } from '@goodboy/types';
import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';

export type ActivityKind = 'agents' | 'branch' | 'check' | 'script' | 'context';

type Params = {
  readonly entry: TimelineTopLevelEntry;
};

type EventParams = {
  readonly kind: SessionEventKind;
};

const eventKindOf = ({ kind }: EventParams): ActivityKind => {
  switch (kind) {
    case 'worktree_created':
    case 'branch_created':
    case 'branch_switched':
    case 'branch_deleted':
    case 'branch_restored':
    case 'pr_created':
    case 'pr_discovered':
    case 'pr_ready':
    case 'pr_approved':
    case 'pr_merged':
    case 'pr_closed':
    case 'project_materialized':
    case 'project_materialization_refused':
    case 'project_materialization_proposed':
    case 'project_materialization_dismissed':
    case 'project_detached':
    case 'rebase_requested':
    case 'write_destination_changed':
    case 'history_rewritten':
    case 'history_pushed':
    case 'history_stopped':
    case 'history_restored':
      return 'branch';
    case 'workflow_started':
    case 'workflow_discarded':
    case 'workflow_restored':
    case 'workflow_closed':
    case 'workflow_deleted':
    case 'question_dismissed':
    case 'question_restored':
      return 'agents';
    case 'issue_linked':
    case 'issue_unlinked':
    case 'decisions_changed':
    case 'external_task_created':
    case 'session_archived':
    case 'session_restored':
      return 'context';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const activityKindOf = ({ entry }: Params): ActivityKind => {
  switch (entry.kind) {
    case 'agent':
    case 'run':
    case 'question':
    case 'plan':
    case 'artifact':
      return 'agents';
    case 'branch':
      return 'branch';
    case 'learning':
    case 'issue':
      return 'context';
    case 'event':
      return eventKindOf({ kind: entry.event.kind });
    case 'work':
      return entry.work.kind === 'check-rerun' ? 'check' : 'script';
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};
