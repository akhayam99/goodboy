import { Bug, GitBranch, GitFork, Link2, ListTodo } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { LinkedWorkRow } from '../../../../shared/components/LinkedWorkRow';
import { workspaceMountName } from '../../../../shared/utils/workspaceMountName';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { PROVIDER_LENS } from '../../../integrations/providerLens';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

const PROVIDER_ORDER: Record<SessionExternalTaskProvider, number> = {
  linear: 0,
  sentry: 1,
  gitlab: 2,
  github: 3,
};

export const LinkedWorkSection = ({ sessionId, onSelectLens }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const workspace = useAppStore((s) => {
    const session = s.sessions.find((candidate) => candidate.id === sessionId);
    return s.workspaces.find((candidate) => candidate.id === session?.workspaceId) ?? null;
  });
  const linkedIssues = github?.linkedIssues ?? [];
  const orderedExternalTasks = [...externalTasks].sort(
    (left, right) => PROVIDER_ORDER[left.provider] - PROVIDER_ORDER[right.provider],
  );
  const linkItems: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'linear',
      label: 'Linear',
      icon: ListTodo,
      onClick: () => onSelectLens('linear'),
    },
    {
      kind: 'item',
      key: 'sentry',
      label: 'Sentry',
      icon: Bug,
      onClick: () => onSelectLens('sentry'),
    },
    {
      kind: 'item',
      key: 'gitlab',
      label: 'GitLab issues',
      icon: GitFork,
      onClick: () => onSelectLens('gitlab_issues'),
    },
  ];
  const hasLinkedWork = linkedIssues.length > 0 || externalTasks.length > 0;
  const openLinkedIssue = (issueNumber: number) => {
    setFocusedGithubIssueNumber(sessionId, issueNumber);
    onSelectLens('github_issue');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Eyebrow label="Linked work" muted className="font-medium" />
        <OverflowMenu
          items={linkItems}
          label="Link work"
          triggerClassName="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium"
          trigger={
            <>
              <Link2 size={11} aria-hidden />
              <span>Link</span>
            </>
          }
        />
      </div>
      {hasLinkedWork ? (
        <div className="flex flex-col gap-2">
          {linkedIssues.map((issue) => (
            <LinkedWorkRow
              key={issue.url}
              leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
              identifier={`#${issue.number}`}
              title={issue.title ?? 'GitHub issue'}
              onClick={() => openLinkedIssue(issue.number)}
              navigation="internal"
              tooltip={`Open issue #${issue.number}`}
              actions={
                <ExternalRefActions
                  url={issue.url}
                  label={`issue #${issue.number}`}
                  hostLabel="GitHub"
                />
              }
            />
          ))}
          {orderedExternalTasks.map((task) => (
            <ExternalTaskChip
              key={`${task.provider}:${task.externalId}:${task.mountWorkspaceId ?? ''}`}
              task={task}
              variant="full"
              appearance="row"
              navigation="internal"
              ariaLabel={`Open ${task.identifier} integration`}
              repoLabel={
                workspaceMountName({
                  workspace,
                  mountWorkspaceId: task.mountWorkspaceId,
                }) ?? undefined
              }
              onClick={() => onSelectLens(PROVIDER_LENS[task.provider])}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
