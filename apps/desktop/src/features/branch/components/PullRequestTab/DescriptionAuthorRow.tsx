import type { ReactNode } from 'react';
import type { PullRequestState } from '@goodboy/types';
import { Person } from '../../../../shared/components/Person';
import { RelativeTime } from '../../../../shared/components/RelativeTime';

type Props = {
  readonly author: PullRequestState['author'];
  readonly openedAt: string | null;
  readonly action: ReactNode;
};

export const DescriptionAuthorRow = ({ author, openedAt, action }: Props) => (
  <div data-slot="description-author" className="flex min-h-6 min-w-0 items-center gap-2">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {author == null ? null : (
        <>
          <Person login={author.login} avatarUrl={author.avatarUrl} size="md" isNameHidden />
          <span className="min-w-0 truncate text-row-strong text-foreground">{author.login}</span>
        </>
      )}
      {openedAt === null ? null : (
        <span className="shrink-0 text-meta text-muted-foreground">
          opened <RelativeTime iso={openedAt} />
        </span>
      )}
    </div>
    <span className="flex shrink-0 items-center gap-2">{action}</span>
  </div>
);
