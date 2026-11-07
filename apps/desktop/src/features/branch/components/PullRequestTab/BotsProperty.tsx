import { Bot } from 'lucide-react';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { PrComment, PullRequestReviewer } from '@goodboy/types';
import { botWordOf } from './botWordOf';
import { PropertyField } from './PropertyField';

type Props = {
  readonly bots: ReadonlyArray<PullRequestReviewer>;
  readonly comments: ReadonlyArray<PrComment> | null;
};

export const BotsProperty = ({ bots, comments }: Props) => {
  if (bots.length === 0) {
    return null;
  }
  return (
    <PropertyField label="Bots">
      <ul className="flex min-w-0 flex-col">
        {bots.map((bot) => {
          const said = botWordOf({ bot, comments });
          return (
            <li
              key={bot.person.login}
              data-bot-tone={said.tone}
              className="flex min-h-7 min-w-0 items-center gap-2 text-meta"
            >
              <Bot
                size={ICON_SIZE.control}
                aria-hidden
                className="shrink-0 text-faint-foreground"
              />
              <span className="min-w-0 truncate text-foreground">{bot.person.login}</span>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  said.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(said.tone).text,
                )}
              >
                {said.word}
              </span>
            </li>
          );
        })}
      </ul>
    </PropertyField>
  );
};
