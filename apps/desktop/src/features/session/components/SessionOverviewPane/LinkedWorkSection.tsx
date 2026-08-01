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

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

const PROVIDER_LENS: Record<SessionExternalTaskProvider, LensKind> = {
  linear: 'linear',
  sentry: 'sentry',
  gitlab: 'gitlab_issues',
  github: 'pr',
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Eyebrow label="Linked work" muted className="font-medium" />
        <OverflowMenu
          items={linkItems}
          label="link work"
          triggerClassName="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium"
          trigger={
            <>
              <Link2 size={11} aria-hidden />
              <span>Link</span>
            </>
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        {linkedIssues.map((issue) => (
          <LinkedWorkRow
            key={issue.url}
            leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
            identifier={`#${issue.number}`}
            title={issue.title ?? 'GitHub issue'}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('goodboy:open-github-studio', {
                  detail: { sessionId, issueExternalId: String(issue.number) },
                }),
              )
            }
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
            ariaLabel={`open ${task.identifier} integration`}
            repoLabel={
              workspaceMountName({
                workspace,
                mountWorkspaceId: task.mountWorkspaceId,
              }) ?? undefined
            }
            onClick={() => onSelectLens(PROVIDER_LENS[task.provider])}
          />
        ))}
        {!hasLinkedWork ? (
          <p className="rounded-lg bg-muted/20 px-3.5 py-2.5 text-sm text-muted-foreground">
            No linked issues or tasks yet.
          </p>
        ) : null}
      </div>
    </div>
  );
};
