import type { PrComment, PrReview, PullRequestReviewer, PullRequestState } from '@goodboy/types';
import { countNoun } from '../../../../shared/utils/countNoun';
import { PeopleRows, type PersonRow } from '../../../../shared/components/OverviewRail/PeopleRows';
import { botCommentCountOf } from './botCommentCountOf';

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
  const rows: ReadonlyArray<PersonRow> = [
    ...(author === null || author === undefined
      ? []
      : [{ login: author.login, avatarUrl: author.avatarUrl, isBot: false, note: 'Author' }]),
    ...bots.map((bot) => ({
      login: bot.person.login,
      avatarUrl: bot.person.avatarUrl,
      isBot: true,
      note: botNoteOf({
        count: botCommentCountOf({ login: bot.person.login, comments, reviews }),
      }),
    })),
  ];
  return <PeopleRows rows={rows} />;
};
