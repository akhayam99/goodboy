import { Button, ScrollFade, Skeleton } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { openLink } from '../../../open/openLink';
import { cleanLogText } from '../../../branch/checks/cleanLogText';
import { DESK_PR_COPY } from './deskPrCopy';
import { useCheckLog } from './useCheckLog';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly name: string;
  readonly url: string | null;
};

export const DeskCheckLog = ({ sessionId, mountId, name, url }: Props) => {
  const log = useCheckLog({ sessionId, mountId, name, url });
  const text = log.text === null ? '' : cleanLogText({ text: log.text });
  return (
    <section aria-label={DESK_PR_COPY.logOf({ name })} className="flex min-w-0 flex-col gap-2">
      <h3 className="truncate text-row text-foreground">{DESK_PR_COPY.logOf({ name })}</h3>
      {log.isReading ? (
        <div className="flex flex-col gap-2">
          <span role="status" className="sr-only">
            {DESK_PR_COPY.readingLog}
          </span>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : text === '' ? (
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-body text-muted-foreground">{DESK_PR_COPY.unreadable}</p>
          {url === null ? null : (
            <Button variant="ghost" size="sm" onClick={() => openLink({ url, sessionId })}>
              {DESK_PR_COPY.openLog}
            </Button>
          )}
        </div>
      ) : (
        <ScrollFade className="max-h-80 min-h-0" viewportClassName="min-h-0">
          <pre
            data-desk-check-log=""
            className="whitespace-pre-wrap break-words text-code text-muted-foreground"
          >
            {text}
          </pre>
        </ScrollFade>
      )}
    </section>
  );
};
