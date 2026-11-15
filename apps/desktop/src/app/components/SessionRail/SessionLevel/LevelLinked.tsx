import { useMemo, useState } from 'react';
import { EmptyLine, SelectableRow, cn } from '@goodboy/ui';
import { ContextExpander } from '../../../../features/session/components/ContextDrawer/ContextExpander';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { buildWorkItems } from '../../../../features/session/workItems';
import { branchRequests } from '../../../../features/session/branchRequests';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';
import { gitlabSessionOf } from '../../../../store/slices/mount-request/requestOf';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { externalTaskLinkKey } from '../../../../store/slices/sessions/externalTaskLinkKey';
import { taskIdentityKey } from '../../../../shared/utils/taskIdentityKey';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { IntegrationGlyph } from '../../../../features/integrations/components/IntegrationGlyph';
import { ObjectMenuArea } from '../../../../features/actions/components/ObjectMenuArea';
import { LinkIssueAction } from '../../../../features/session/components/SessionOverviewPane/LinkIssueAction';
import { openGithubIssue } from '../../../../features/session/openGithubIssue';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { githubRefOf } from './githubRefOf';
import { LevelCard } from './LevelCard';
import { CARD_ROW_INSET } from './railInset';
import { useLevelCardFold } from './useLevelCardFold';
import { LinkedKey } from './LinkedKey';
import { LinkedTaskRow } from './LinkedTaskRow';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

const LABEL_ID = 'level-linked-label';

const TASK_LENSES: ReadonlySet<LensKind | null> = new Set<LensKind | null>([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
]);

const PROVIDER_ORDER: Record<SessionExternalTaskProvider, number> = {
  linear: 0,
  sentry: 1,
  gitlab: 2,
  github: 3,
  jira: 4,
  bitbucket: 5,
  slack: 6,
};

export const LevelLinked = ({ session, isActive }: Props) => {
  const sessionId = session.id;
  const allLinkedIssues = useAppStore(
    (s) => s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY,
  );
  const allExternalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const isLinkedLoaded = useAppStore((s) => s.sessionExternalTasks[sessionId] !== undefined);
  const groups = useMountRows({ sessionId });
  const [isHistoryShown, setIsHistoryShown] = useState(false);
  const currentBranch = useSessionRepo({ sessionId })?.branch ?? null;
  const branchPrs = useAppStore((state) => selectActiveProjectPrs({ state, sessionId }));
  const mr = useAppStore((state) => gitlabSessionOf({ state, sessionId })?.mr ?? null);
  const ownedRefs = useMemo(
    () =>
      new Set(
        groups.flatMap((group) =>
          [...group.rows, ...group.finishedRows].flatMap((row) => {
            const ref =
              row.request?.provider === 'github' ? githubRefOf({ url: row.request.url }) : null;
            return ref === null ? [] : [ref];
          }),
        ),
      ),
    [groups],
  );
  const isOwned = (url: string): boolean => {
    const ref = githubRefOf({ url });
    return ref !== null && ownedRefs.has(ref);
  };
  const linkedIssues = allLinkedIssues.filter((issue) => !isOwned(issue.url));
  const externalTasks = allExternalTasks.filter(
    (task) => task.provider !== 'github' || !isOwned(task.url),
  );
  const shownTask = useAppStore((s) =>
    TASK_LENSES.has(s.activeLens[sessionId] ?? null)
      ? (s.focusedExternalTask[sessionId] ?? null)
      : null,
  );
  const shownIssue = useAppStore((s) =>
    s.activeLens[sessionId] === 'github_issue'
      ? (s.focusedGithubIssueNumber[sessionId] ?? null)
      : null,
  );
  const mountBranches = groups.flatMap((group) =>
    [...group.rows, ...group.finishedRows].map((row) => ({
      branch: row.branch,
      projectId: row.projectId,
      state: row.request?.state ?? null,
    })),
  );
  const workItems = buildWorkItems({
    tasks: externalTasks,
    currentBranch,
    branchPrs: branchRequests({ prs: branchPrs, mr, branch: currentBranch }),
    mountBranches,
  });
  const currentKeys = new Set(workItems.current.map(({ task }) => taskIdentityKey({ task })));
  const allTasks = [...distinctTasks({ tasks: externalTasks })].sort(
    (left, right) => PROVIDER_ORDER[left.task.provider] - PROVIDER_ORDER[right.task.provider],
  );
  const currentTasks = allTasks.filter(({ task }) => currentKeys.has(taskIdentityKey({ task })));
  const historyTasks = allTasks.filter(({ task }) => !currentKeys.has(taskIdentityKey({ task })));
  const tasks = [...currentTasks, ...(isHistoryShown ? historyTasks : [])];
  const isArchived = session.archivedAt != null;
  const fold = useLevelCardFold({ card: 'linked' });
  const count = linkedIssues.length + currentTasks.length + historyTasks.length;

  return (
    <LevelCard
      id={LABEL_ID}
      label="Linked"
      isOpen={fold.isOpen}
      onToggle={fold.toggle}
      count={count}
      {...(!isArchived && {
        action: <LinkIssueAction session={session} isShortcutOn={isActive} look="level" />,
      })}
    >
      <ul aria-label="Linked work" className="flex flex-col">
        {linkedIssues.map((issue) => {
          const isShown = isActive && shownIssue === issue.number;
          return (
            <li key={issue.url}>
              <ObjectMenuArea
                target={{ kind: 'link', href: issue.url }}
                anchorKey={`linked-issue:${issue.url}`}
              >
                <SelectableRow
                  selected={isShown}
                  ariaCurrent={isShown ? 'page' : undefined}
                  ariaLabel={`Open issue #${issue.number}`}
                  {...(issue.title !== undefined && issue.title !== null && { title: issue.title })}
                  onClick={() => openGithubIssue({ sessionId, issueNumber: issue.number })}
                  className={cn('h-7 items-center gap-2 text-ui', CARD_ROW_INSET)}
                >
                  <IntegrationGlyph provider="github" size="xs" className="shrink-0" />
                  <LinkedKey identifier={`#${issue.number}`} />
                  <span className="min-w-0 flex-1 truncate">{issue.title ?? ''}</span>
                </SelectableRow>
              </ObjectMenuArea>
            </li>
          );
        })}
        {tasks.map(({ task, branches }) => (
          <li key={externalTaskLinkKey({ task: { ...task, scope: 'session' } })}>
            <LinkedTaskRow
              sessionId={sessionId}
              task={task}
              branches={branches}
              isShown={
                isActive &&
                shownTask !== null &&
                shownTask.provider === task.provider &&
                shownTask.externalId === task.externalId
              }
            />
          </li>
        ))}
      </ul>
      {isLinkedLoaded && count === 0 ? (
        <div className={CARD_ROW_INSET}>
          <EmptyLine>Issues, errors and threads this session works on.</EmptyLine>
        </div>
      ) : null}
      {historyTasks.length === 0 ? null : (
        <div className={cn('flex', CARD_ROW_INSET)}>
          <ContextExpander
            label="History"
            count={historyTasks.length}
            isOpen={isHistoryShown}
            onToggle={() => setIsHistoryShown((isShown) => !isShown)}
          />
        </div>
      )}
    </LevelCard>
  );
};
