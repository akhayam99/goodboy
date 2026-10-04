import type { ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { LinkedIssue } from '@goodboy/types';
import { ExternalRefActions } from '../../../../../shared/components/ExternalRefActions';
import { LinkedWorkRow } from '../../../../../shared/components/LinkedWorkRow';

type Props = {
  readonly issues: ReadonlyArray<LinkedIssue>;
  readonly action: ReactNode;
  readonly onOpenIssue: (issueNumber: number) => void;
};

export const LinkedIssuesSection = ({ issues, action, onOpenIssue }: Props) => {
  if (issues.length === 0 && action === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Eyebrow label="Linked issues" muted className="px-0.5 font-medium" />
        {action}
      </div>
      <div className="flex flex-col gap-1">
        {issues.map((issue) => (
          <LinkedWorkRow
            key={issue.url}
            leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
            identifier={`#${issue.number}`}
            title={issue.title ?? 'GitHub issue'}
            navigation="internal"
            onClick={() => onOpenIssue(issue.number)}
            actions={
              <ExternalRefActions
                url={issue.url}
                label={`issue #${issue.number}`}
                hostLabel="GitHub"
              />
            }
          />
        ))}
      </div>
    </div>
  );
};
