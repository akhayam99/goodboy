import { useMemo } from 'react';
import { EmptyLine, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { LinkedIssue, PullRequestState, PullRequestView, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { closingIssueReferences } from '../../../integrations/github/closingIssueReferences';
import { LinkIssueToPrPopover } from './LinkIssueToPrPopover';
import { openLens } from '../../../session/openLens';
import { PropertyBlock } from './PropertyBlock';

type Props = {
  readonly sessionId: SessionId;
  readonly pr: PullRequestState;
  readonly view: PullRequestView | null;
  readonly canEdit: boolean;
};

type Resolved = {
  readonly key: string;
  readonly label: string;
  readonly title: string;
  readonly number: number | null;
};

const fromLinked = ({ issue }: { readonly issue: LinkedIssue }): Resolved => ({
  key: issue.url,
  label: `#${issue.number}`,
  title: issue.title ?? 'GitHub issue',
  number: issue.number,
});

export const ResolvesProperty = ({ sessionId, pr, view, canEdit }: Props) => {
  const linkedIssues = useAppStore((s) => s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const repo = useSessionRepo({ sessionId });
  const branch = repo?.branch ?? null;

  const rows = useMemo<ReadonlyArray<Resolved>>(() => {
    if (linkedIssues.length > 0) {
      return linkedIssues.map((issue) => fromLinked({ issue }));
    }
    return (view?.resolves ?? []).map((resolve) => ({
      key: resolve.label,
      label: resolve.label,
      title: resolve.isClosing ? 'Closes when this merges' : 'Mentioned',
      number: null,
    }));
  }, [linkedIssues, view]);

  const candidates = useMemo(() => {
    const linked = new Set(linkedIssues.map((issue) => issue.number));
    return closingIssueReferences({
      tasks: externalTasks.filter((task) => task.provider === 'github'),
      branch,
      body: pr.body,
    }).filter((reference) => !linked.has(reference.number));
  }, [branch, externalTasks, linkedIssues, pr.body]);

  const hasGithubTasks = externalTasks.some((task) => task.provider === 'github');
  const action =
    canEdit && hasGithubTasks ? (
      <LinkIssueToPrPopover
        sessionId={sessionId}
        prNumber={pr.number}
        body={pr.body}
        candidates={candidates}
      />
    ) : null;

  if (rows.length === 0 && action === null) {
    return null;
  }

  return (
    <PropertyBlock label="Resolves" action={action}>
      {rows.length === 0 ? (
        <EmptyLine>Nothing linked yet</EmptyLine>
      ) : (
        <ul className="flex min-w-0 flex-col">
          {rows.map((row) => (
            <li key={row.key} className="min-w-0">
              <button
                type="button"
                disabled={row.number === null}
                onClick={() => {
                  if (row.number === null) {
                    return;
                  }
                  setFocusedGithubIssueNumber(sessionId, row.number);
                  openLens({ sessionId, lens: 'github_issue' });
                }}
                className={cn(
                  'flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-label',
                  row.number === null ? 'cursor-default' : ROW_INTERACTIVE,
                )}
              >
                <CONCEPT_ICONS.issues
                  size={ICON_SIZE.control}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
                <span className="shrink-0 text-code text-foreground">{row.label}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PropertyBlock>
  );
};
