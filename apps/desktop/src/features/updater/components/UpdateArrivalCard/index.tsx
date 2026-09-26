import { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { Button, InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useRunningAgentCount } from '../../hooks/useRunningAgentCount';
import { useUpdateArrivalCard } from '../../hooks/useUpdateArrivalCard';
import { arrivalBullets, arrivalLead, arrivalTitle } from '../../updateArrivalCopy';

type Props = {
  readonly onOpenChangelog: () => void;
};

export const UpdateArrivalCard = ({ onOpenChangelog }: Props) => {
  const version = useAppStore((state) => state.updateVersion);
  const notes = useAppStore((state) => state.updateNotes);
  const applyUpdate = useAppStore((state) => state.applyUpdate);
  const setUpdateQueuedUntilIdle = useAppStore((state) => state.setUpdateQueuedUntilIdle);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const runningCount = useRunningAgentCount();
  const { isVisible, snooze } = useUpdateArrivalCard();
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false);

  if (!isVisible) {
    return null;
  }

  if (isConfirmingRestart && runningCount > 0) {
    return (
      <div className="fixed bottom-[46px] left-1/2 z-popover w-[368px] -translate-x-1/2">
        <InlineConfirm
          role="alert"
          icon={<ArrowUpCircle size={ICON_SIZE.control} aria-hidden />}
          title={`${runningCount} agent${runningCount === 1 ? '' : 's'} ${runningCount === 1 ? 'is' : 'are'} running. Restarting stops them.`}
          confirmLabel="Restart when they finish"
          cancelLabel="Restart now"
          onConfirm={() => {
            setUpdateQueuedUntilIdle({ queued: true });
            setIsConfirmingRestart(false);
          }}
          onCancel={() => {
            void applyUpdate();
          }}
        />
      </div>
    );
  }

  const bullets = arrivalBullets({ notes });
  const lead = arrivalLead({ notes });

  return (
    <div className="fixed bottom-[46px] left-1/2 z-popover w-[368px] -translate-x-1/2 rounded-lg border border-border-soft bg-floating p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <ArrowUpCircle
          size={ICON_SIZE.control}
          aria-hidden
          className="mt-0.5 shrink-0 text-primary"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{arrivalTitle({ version })}</p>
          {lead !== null ? <p className="text-xs text-muted-foreground">{lead}</p> : null}
          {bullets.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {bullets.map((bullet) => (
                <li key={bullet.title} className="flex items-start gap-1.5">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1 shrink-0 rounded-full bg-faint-foreground"
                  />
                  {bullet.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            snooze();
          }}
        >
          Later
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            focusChangelogRelease({ version });
            onOpenChangelog();
          }}
        >
          What's new
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (runningCount > 0) {
              setIsConfirmingRestart(true);
              return;
            }
            void applyUpdate();
          }}
        >
          Restart now
        </Button>
      </div>
    </div>
  );
};
