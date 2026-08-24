import type {
  LinkedIssue,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { VITAL_CHIP } from './vitalChip';

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
  <button
    type="button"
    onClick={onOpen}
    title={issue.title ?? `Open issue #${issue.number}`}
    aria-label={`Open issue #${issue.number}`}
    className={VITAL_CHIP}
  >
    <IntegrationGlyph provider="github" size="xs" />
    <span className="font-mono">#{issue.number}</span>
  </button>
);

type TaskChipProps = {
  readonly task: SessionExternalTask;
  readonly onOpen: () => void;
};

const TaskChip = ({ task, onOpen }: TaskChipProps) => (
  <button
    type="button"
    onClick={onOpen}
    title={`${task.identifier}: ${task.title}`}
    aria-label={`Open ${task.identifier}`}
    className={VITAL_CHIP}
  >
    <IntegrationGlyph provider={task.provider} size="xs" />
    <span className="font-mono">{task.identifier}</span>
  </button>
);

export const LinkedWorkChips = ({ sessionId, onSelectLens }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const openExternalTaskLens = useAppStore((s) => s.openExternalTaskLens);
  const linkedIssues = github?.linkedIssues ?? [];
  const orderedTasks = [...externalTasks].sort(
    (left, right) => PROVIDER_ORDER[left.provider] - PROVIDER_ORDER[right.provider],
  );
  if (linkedIssues.length === 0 && orderedTasks.length === 0) {
    return null;
  }
  return (
    <div aria-label="Linked work" className="flex min-w-0 flex-wrap items-center justify-end gap-1">
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
          key={`${task.provider}:${task.externalId}:${task.projectId ?? ''}`}
          task={task}
          onOpen={() => openExternalTaskLens(sessionId, task)}
        />
      ))}
    </div>
  );
};
