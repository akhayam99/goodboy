import { useMemo } from 'react';
import { cn, EmptyLine, ROW_INTERACTIVE, StatusDot, TruncatedText } from '@goodboy/ui';
import type {
  LinkedIssue,
  MountId,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchGithubOf } from '../../../../store/slices/github/branchGithubOf';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { closingIssueReferences } from '../../../integrations/github/closingIssueReferences';
import { LinkIssueToPrPopover } from './LinkIssueToPrPopover';
import { openGithubIssue } from '../../../session/openGithubIssue';
import { PropertyField } from './PropertyField';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly pr: PullRequestState;
  readonly view: PullRequestView | null;
  readonly canEdit: boolean;
};

type Resolved = {
  readonly key: string;
  readonly relation: string;
  readonly label: string;
  readonly title: string;
  readonly number: number | null;
};

const fromLinked = ({ issue }: { readonly issue: LinkedIssue }): Resolved => ({
  key: issue.url,
  relation: issue.closes ? 'Closes' : 'Mentions',
  label: `#${issue.number}`,
  title: issue.title ?? 'GitHub issue',
  number: issue.number,
});

export const ResolvesProperty = ({ sessionId, mountId, pr, view, canEdit }: Props) => {
  const linkedIssues = useAppStore(
    (s) => branchGithubOf({ state: s, sessionId, mountId })?.linkedIssues ?? EMPTY_ARRAY,
  );
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const repo = useSessionRepo({ sessionId, mountId });
  const branch = repo?.branch ?? null;

  const rows = useMemo<ReadonlyArray<Resolved>>(() => {
    if (linkedIssues.length > 0) {
      return linkedIssues.map((issue) => fromLinked({ issue }));
    }
    return (view?.resolves ?? []).map((resolve) => ({
      key: resolve.label,
      relation: resolve.isClosing ? 'Closes' : 'Mentions',
      label: resolve.label,
      title: '',
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
        mountId={mountId}
        prNumber={pr.number}
        body={pr.body}
        candidates={candidates}
      />
    ) : null;

  if (rows.length === 0 && action === null) {
    return null;
  }

  return (
    <PropertyField label="Linked issues" action={action}>
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
                  openGithubIssue({ sessionId, issueNumber: row.number });
                }}
                className={cn(
                  'flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md text-left text-ui',
                  row.number === null ? 'cursor-default' : ROW_INTERACTIVE,
                )}
              >
                <StatusDot
                  tone={row.relation === 'Closes' ? 'success' : 'neutral'}
                  title={row.relation}
                />
                <span className="shrink-0 text-code text-foreground">{row.label}</span>
                <TruncatedText className="min-w-0 flex-1 text-foreground" tooltip={row.title}>
                  {row.title}
                </TruncatedText>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PropertyField>
  );
};
