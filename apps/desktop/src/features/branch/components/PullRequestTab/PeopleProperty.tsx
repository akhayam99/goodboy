import { cn } from '@goodboy/ui';
import type { PrComment, PrReview, PullRequestReviewer, PullRequestState } from '@goodboy/types';
import { countNoun } from '../../../../shared/utils/countNoun';
import { Person } from '../../../../shared/components/Person';
import { botCommentCountOf } from './botCommentCountOf';
import { PROPERTY_ROW } from './propertyRow';
import { PropertyField } from './PropertyField';

type Props = {
  readonly author: PullRequestState['author'];
  readonly bots: ReadonlyArray<PullRequestReviewer>;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly reviews: ReadonlyArray<Pick<PrReview, 'author' | 'state' | 'body'>>;
};

type NoteParams = {
  readonly count: number;
};

const botNoteOf = ({ count }: NoteParams): string =>
  count === 0 ? 'Bot' : `Bot · ${countNoun({ count, one: 'comment', many: 'comments' })}`;

export const PeopleProperty = ({ author, bots, comments, reviews }: Props) => {
  if ((author === null || author === undefined) && bots.length === 0) {
    return null;
  }
  return (
    <PropertyField label="People">
      <ul className="flex min-w-0 flex-col">
        {author === null || author === undefined ? null : (
          <li className={cn(PROPERTY_ROW, 'justify-between')}>
            <Person login={author.login} avatarUrl={author.avatarUrl} size="sm" />
            <span className="shrink-0 text-meta text-muted-foreground">Author</span>
          </li>
        )}
        {bots.map((bot) => (
          <li
            key={bot.person.login}
            data-person-note="bot"
            className={cn(PROPERTY_ROW, 'justify-between')}
          >
            <Person login={bot.person.login} avatarUrl={bot.person.avatarUrl} size="sm" isBot />
            <span className="shrink-0 text-meta text-muted-foreground">
              {botNoteOf({
                count: botCommentCountOf({ login: bot.person.login, comments, reviews }),
              })}
            </span>
          </li>
        ))}
      </ul>
    </PropertyField>
  );
};
