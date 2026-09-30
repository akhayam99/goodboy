import { useMemo } from 'react';
import type { PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { LensKind } from '../../../../../store';
import { RecordProperties } from '../../../../../shared/components/StudioDetail/RecordProperties';
import { githubPullRequestFields, resolveFacts } from '../../../../../shared/detail-fields';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { closingIssueReferences } from '../../../../integrations/github/closingIssueReferences';
import { LinkIssueToPrPopover } from '../../../../integrations/github/components/LinkIssueToPrPopover';
import { PrOverview } from '../../../../integrations/github/components/PullRequest/PrOverview';
import { PrReviewers } from '../../../../integrations/github/components/PullRequest/PrReviewers';
import {
  PR_EDIT_DETAILS_EVENT,
  PR_REQUEST_REVIEW_EVENT,
  pullRequestEventName,
} from '../../../../actions/kinds/pullRequest';
import { LinkedIssuesSection } from './LinkedIssuesSection';

type Props = {
  readonly sessionId: SessionId;
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly canEdit: boolean;
  readonly canRequestReview: boolean;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly onMutated: () => void;
};

export const PrDetailsMode = ({
  sessionId,
  pr,
  detail,
  canEdit,
  canRequestReview,
  onSelectLens,
  onMutated,
}: Props) => {
  const linkedIssues = useAppStore((s) => s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const requestReview = useAppStore((s) => s.requestReview);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
  const repo = useSessionRepo({ sessionId });
  const branch = repo?.branch ?? null;

  const checks = detail?.checks ?? EMPTY_ARRAY;
  const properties = useMemo(
    () => resolveFacts({ registry: githubPullRequestFields, entity: { pr, checks } }),
    [checks, pr],
  );
  const linkedIssueNumbers = useMemo(
    () => new Set(linkedIssues.map((issue) => issue.number)),
    [linkedIssues],
  );
  const githubTasks = useMemo(
    () => externalTasks.filter((task) => task.provider === 'github'),
    [externalTasks],
  );
  const linkCandidates = useMemo(
    () =>
      closingIssueReferences({ tasks: githubTasks, branch, body: pr.body }).filter(
        (reference) => !linkedIssueNumbers.has(reference.number),
      ),
    [branch, githubTasks, linkedIssueNumbers, pr.body],
  );

  const onAddReviewers = (logins: ReadonlyArray<string>) => {
    void (async () => {
      await requestReview(sessionId, pr.number, logins).catch(() => undefined);
      onMutated();
    })();
  };

  return (
    <section aria-label="PR details" className="flex flex-col gap-6">
      <RecordProperties facts={properties} />
      <PrOverview
        pr={pr}
        sessionId={sessionId}
        canEdit={canEdit}
        editEventName={pullRequestEventName({ name: PR_EDIT_DETAILS_EVENT, sessionId })}
        onMutated={onMutated}
      />
      <LinkedIssuesSection
        issues={linkedIssues}
        action={
          githubTasks.length > 0 ? (
            <LinkIssueToPrPopover
              sessionId={sessionId}
              prNumber={pr.number}
              body={pr.body}
              candidates={linkCandidates}
            />
          ) : null
        }
        onOpenIssue={(issueNumber) => {
          setFocusedGithubIssueNumber(sessionId, issueNumber);
          onSelectLens('github_issue');
        }}
      />
      <PrReviewers
        detail={detail}
        projectRoot={repo?.repoRoot ?? null}
        {...(repo?.projectId !== undefined && { projectId: repo.projectId })}
        canRequest={canRequestReview}
        requestEventName={pullRequestEventName({ name: PR_REQUEST_REVIEW_EVENT, sessionId })}
        onAddReviewers={onAddReviewers}
      />
    </section>
  );
};
