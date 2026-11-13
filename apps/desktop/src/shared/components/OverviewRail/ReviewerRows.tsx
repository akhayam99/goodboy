import { Avatar, cn } from '@goodboy/ui';
import type { PullRequestReviewer } from '@goodboy/types';
import { PROPERTY_ROW } from './propertyRow';
import { REVIEWER_STATE_TEXT } from './reviewerStateTone';
import { REVIEWER_STATE_WORD } from './reviewerStateWord';

type Props = {
  readonly people: ReadonlyArray<PullRequestReviewer>;
};

export const ReviewerRows = ({ people }: Props) => (
  <ul className="flex min-w-0 flex-col">
    {people.map((reviewer) => (
      <li key={reviewer.person.login} data-reviewer-state={reviewer.state} className={PROPERTY_ROW}>
        <Avatar url={reviewer.person.avatarUrl} alt={reviewer.person.login} size="sm" />
        <span className="min-w-0 flex-1 truncate text-foreground">{reviewer.person.login}</span>
        <span className={cn('shrink-0 text-meta', REVIEWER_STATE_TEXT[reviewer.state])}>
          {REVIEWER_STATE_WORD[reviewer.state]}
        </span>
      </li>
    ))}
  </ul>
);
