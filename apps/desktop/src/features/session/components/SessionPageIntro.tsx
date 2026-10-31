import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { SESSION_PAGE_INTRO } from '../sessionPageIntro';

type Props = {
  readonly page: keyof typeof SESSION_PAGE_INTRO;
};

export const SessionPageIntro = ({ page }: Props) => (
  <div
    data-slot="session-page-intro"
    data-page={page}
    className={cn('flex min-w-0 flex-col text-ui text-muted-foreground', PANE_RHYTHM.prose)}
  >
    {SESSION_PAGE_INTRO[page].map((line) => (
      <p key={line}>{line}</p>
    ))}
  </div>
);
