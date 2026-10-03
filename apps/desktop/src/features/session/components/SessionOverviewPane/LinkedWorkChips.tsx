import { GitBranch } from 'lucide-react';
import { Chip, SkeletonChip } from '@goodboy/ui';
import type {
  LinkedIssue,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { externalTaskLinkKey } from '../../../../store/slices/sessions/externalTaskLinkKey';
import { useSessionSkeleton } from '../../hooks/useSessionSkeleton';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

const PROVIDER_ORDER: Record<SessionExternalTaskProvider, number> = {
  linear: 0,
  sentry: 1,
  gitlab: 2,
  github: 3,
  jira: 4,
  bitbucket: 5,
  slack: 6,
};

type IssueChipProps = {
  readonly issue: LinkedIssue;
  readonly onOpen: () => void;
};

const IssueChip = ({ issue, onOpen }: IssueChipProps) => (
  <Chip
    as="button"
    tone="neutral"
    shape="badge"
    size="control"
    onClick={onOpen}
    title={issue.title ?? `Open issue #${issue.number}`}
    ariaLabel={`Open issue #${issue.number}`}
    icon={<IntegrationGlyph provider="github" size="xs" />}
    label={<span className="font-mono">#{issue.number}</span>}
  />
);

type TaskChipProps = {
  readonly task: SessionExternalTask;
  readonly onOpen: () => void;
};

const TaskChip = ({ task, onOpen }: TaskChipProps) => {
  const onBranch = task.scope === 'branch' ? (task.branch ?? null) : null;
  return (
    <Chip
      as="button"
      tone="neutral"
      shape="badge"
      size="control"
      onClick={onOpen}
      title={
        onBranch === null
          ? `${task.identifier}: ${task.title}`
          : `${task.identifier} on ${onBranch}: ${task.title}`
      }
      ariaLabel={
        onBranch === null ? `Open ${task.identifier}` : `Open ${task.identifier} on ${onBranch}`
      }
      icon={
        onBranch === null ? (
          <IntegrationGlyph provider={task.provider} size="xs" />
        ) : (
          <span className="flex items-center gap-1">
            <IntegrationGlyph provider={task.provider} size="xs" />
            <GitBranch size={11} aria-hidden />
          </span>
        )
      }
      label={<span className="font-mono">{task.identifier}</span>}
    />
  );
};

export const LinkedWorkChips = ({ sessionId, onSelectLens }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const openExternalTaskLens = useAppStore((s) => s.openExternalTaskLens);
  const isSkeleton = useSessionSkeleton({ sessionId });
  const linkedIssues = github?.linkedIssues ?? [];
  const orderedTasks = [...externalTasks].sort(
    (left, right) => PROVIDER_ORDER[left.provider] - PROVIDER_ORDER[right.provider],
  );
  if (linkedIssues.length === 0 && orderedTasks.length === 0) {
    return null;
  }
  if (isSkeleton) {
    return (
      <div
        role="status"
        aria-label="Refreshing linked work"
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        {[
          ...linkedIssues.map((issue) => issue.url),
          ...orderedTasks.map((task) => externalTaskLinkKey({ task })),
        ].map((key) => (
          <SkeletonChip key={key} />
        ))}
      </div>
    );
  }
  return (
    <div aria-label="Linked work" className="flex min-w-0 flex-wrap items-center gap-2">
      {linkedIssues.map((issue) => (
        <IssueChip
          key={issue.url}
          issue={issue}
          onOpen={() => {
            setFocusedGithubIssueNumber(sessionId, issue.number);
            onSelectLens('github_issue');
          }}
        />
      ))}
      {orderedTasks.map((task) => (
        <TaskChip
          key={externalTaskLinkKey({ task })}
          task={task}
          onOpen={() => openExternalTaskLens(sessionId, task)}
        />
      ))}
    </div>
  );
};
