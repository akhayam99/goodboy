import { EmptyLine, Skeleton, cn } from '@goodboy/ui';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { FirstIssues } from '../useFirstIssues';
import { StepListRow } from './StepListRow';

type Props = {
  readonly issues: FirstIssues;
  readonly folderName: string;
  readonly pickedId: string | null;
  readonly onPick: (issue: IssueCandidate) => void;
};

const PROVIDER_NAME: Readonly<Record<IssueCandidate['provider'], string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  linear: 'Linear',
  jira: 'Jira',
  sentry: 'Sentry',
  slack: 'Slack',
};

export const HandOff = ({ issues, folderName, pickedId, onPick }: Props) => {
  if (!issues.isLoaded) {
    return <Skeleton className="h-36 w-full rounded-lg" />;
  }
  if (issues.rows.length === 0) {
    return (
      <EmptyLine>
        {issues.failure === null
          ? 'No open issues assigned to you. Ask about the code instead.'
          : `Couldn't load your issues. ${issues.failure}`}
      </EmptyLine>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Issues" className="flex flex-col rounded-lg bg-fill p-1">
        {issues.rows.map((issue) => {
          const isPicked = issue.externalId === pickedId;
          return (
            <StepListRow
              key={`${issue.provider}:${issue.externalId}`}
              rowId={issue.externalId}
              isPressed={isPicked}
              onPress={() => onPick(issue)}
              icon={
                <span
                  className={cn(
                    'size-4 rounded-full ring-inset motion-safe:transition-shadow',
                    isPicked ? 'ring-[5px] ring-primary' : 'ring-1 ring-border',
                  )}
                />
              }
              name={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-code text-faint-foreground">
                    {issue.identifier}
                  </span>
                  <span className="truncate">{issue.title}</span>
                </span>
              }
              line={`${folderName} · ${PROVIDER_NAME[issue.provider]}`}
            />
          );
        })}
      </ul>
      <p className="text-meta text-faint-foreground">
        Goodboy drafts a brief from the issue. You read it before anything runs.
      </p>
    </div>
  );
};
