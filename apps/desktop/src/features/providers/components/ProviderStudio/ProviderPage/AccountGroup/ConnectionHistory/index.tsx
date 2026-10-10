import { AnchoredPopover, EmptyLine, Button, ScrollFade, Tooltip, useDropdown } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../../../store/store';
import { useNow } from '../../../../../../../shared/hooks/useNow';
import { formatAge } from '../../../../../../../shared/utils/time/formatAge';
import { formatDateTime } from '../../../../../../../shared/utils/time/formatDateTime';

type Props = {
  readonly providerId: ProviderId;
  readonly label: string;
};

type ReasonParams = {
  readonly reason: string;
  readonly label: string;
};

const reasonInWords = ({ reason, label }: ReasonParams): string => {
  if (reason.includes('timeout') || reason.includes('timed out')) {
    return 'Probe timed out';
  }
  if (reason === 'a run was accepted') {
    return `${label} accepted a run`;
  }
  if (reason.includes('three runs refused')) {
    return `${label} refused three runs; using another provider`;
  }
  if (reason === 'probe confirmed') {
    return 'Sign-in check passed';
  }
  if (reason === 'probe answered again') {
    return 'Sign-in check answered again';
  }
  if (reason === 'binary not found') {
    return 'CLI not found';
  }
  if (reason === 'not logged in' || reason === 'not logged in twice') {
    return 'CLI reported signed out';
  }
  return reason.charAt(0).toUpperCase() + reason.slice(1).replaceAll('_', ' ');
};

export const ConnectionHistory = ({ providerId, label }: Props) => {
  const events = useAppStore((state) => state.providerHealth[providerId].events);
  const dropdown = useDropdown({ align: 'end', width: 'w-96', expectedWidth: 384, maxWidth: 384 });
  const now = useNow(30_000, dropdown.open);
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="flex"
      className="w-96"
      trigger={
        <Button variant="ghost" size="sm" aria-expanded={dropdown.open} onClick={dropdown.toggle}>
          History
        </Button>
      }
    >
      <section aria-label={`${label} connection history`} className="flex flex-col gap-3 p-3">
        <h3 className="text-label text-foreground">History of changes</h3>
        {events.length === 0 ? (
          <EmptyLine>No changes since Goodboy started.</EmptyLine>
        ) : (
          <ScrollFade className="max-h-80">
            <ol className="flex flex-col gap-3">
              {events
                .slice(-20)
                .reverse()
                .map((event, index) => (
                  <li key={`${event.at}-${index}`} className="flex flex-col gap-1 text-label">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span>
                        {event.from.replaceAll('_', ' ')} → {event.to.replaceAll('_', ' ')}
                      </span>
                      <Tooltip content={formatDateTime({ at: event.at, hasYear: true })}>
                        <time
                          dateTime={new Date(event.at).toISOString()}
                          tabIndex={0}
                          className="shrink-0 tabular-nums"
                        >
                          {formatAge({ from: event.at, now })}
                        </time>
                      </Tooltip>
                    </div>
                    <span className="text-foreground">
                      {reasonInWords({ reason: event.reason, label })}
                    </span>
                  </li>
                ))}
            </ol>
          </ScrollFade>
        )}
      </section>
    </AnchoredPopover>
  );
};
