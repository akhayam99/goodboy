import { Avatar } from '@goodboy/ui';
import type { PullRequestReviewer } from '@goodboy/types';
import { PropertyField } from './PropertyField';

type Props = {
  readonly bots: ReadonlyArray<PullRequestReviewer>;
};

export const BotsProperty = ({ bots }: Props) => {
  if (bots.length === 0) {
    return null;
  }
  return (
    <PropertyField label="Bots that commented">
      <ul className="flex min-w-0 flex-col">
        {bots.map((bot) => (
          <li key={bot.person.login} className="flex min-h-7 min-w-0 items-center gap-2 text-meta">
            <Avatar url={bot.person.avatarUrl} alt={bot.person.login} size="xs" />
            <span className="min-w-0 truncate text-muted-foreground">{bot.person.login}</span>
          </li>
        ))}
      </ul>
    </PropertyField>
  );
};
