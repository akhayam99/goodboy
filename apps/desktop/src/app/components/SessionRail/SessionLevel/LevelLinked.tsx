import { useMemo } from 'react';
import { SelectableRow } from '@goodboy/ui';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { externalTaskLinkKey } from '../../../../store/slices/sessions/externalTaskLinkKey';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { IntegrationGlyph } from '../../../../features/integrations/components/IntegrationGlyph';
import { LinkIssueAction } from '../../../../features/session/components/SessionOverviewPane/LinkIssueAction';
import { openLens } from '../../../../features/session/openLens';
import { useMountRows } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { githubRefOf } from './githubRefOf';
import { countSlotText } from '../../../../shared/utils/countSlotText';
import { LevelCard } from './LevelCard';
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
  const groups = useMountRows({ sessionId });
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
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const isOverview = useAppStore((s) => (s.activeLens[sessionId] ?? null) === null);
  const tasks = [...distinctTasks({ tasks: externalTasks })].sort(
    (left, right) => PROVIDER_ORDER[left.task.provider] - PROVIDER_ORDER[right.task.provider],
  );
  const isArchived = session.archivedAt != null;
  const fold = useLevelCardFold({ card: 'linked' });
  const count = countSlotText({ count: linkedIssues.length + tasks.length, isBesideGlyph: true });

  return (
    <LevelCard
      id={LABEL_ID}
      label="Linked"
      isOpen={fold.isOpen}
      onToggle={fold.toggle}
      {...(count !== null && {
        meta: <span className="text-meta tabular-nums text-faint-foreground">{count}</span>,
      })}
      {...(!isArchived && {
        action: (
          <LinkIssueAction session={session} isShortcutOn={isActive && isOverview} look="level" />
        ),
      })}
    >
      <ul aria-label="Linked work" className="flex flex-col">
        {linkedIssues.map((issue) => {
          const isShown = isActive && shownIssue === issue.number;
          return (
            <li key={issue.url}>
              <SelectableRow
                selected={isShown}
                ariaCurrent={isShown ? 'page' : undefined}
                ariaLabel={`Open issue #${issue.number}`}
                {...(issue.title !== undefined && issue.title !== null && { title: issue.title })}
                onClick={() => {
                  setFocusedGithubIssueNumber(sessionId, issue.number);
                  openLens({ sessionId, lens: 'github_issue' });
                }}
                className="h-7 items-center gap-2 px-1 text-ui"
              >
                <IntegrationGlyph provider="github" size="xs" className="shrink-0" />
                <LinkedKey identifier={`#${issue.number}`} />
                <span className="min-w-0 flex-1 truncate">{issue.title ?? ''}</span>
              </SelectableRow>
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
    </LevelCard>
  );
};
