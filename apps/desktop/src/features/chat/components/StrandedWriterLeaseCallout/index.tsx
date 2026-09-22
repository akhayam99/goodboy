import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button, cn, tintClasses } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

const warningTint = tintClasses('warning');

type Props = {
  readonly holder: string;
  readonly resource: string;
  readonly waitedMs: number;
};

export const StrandedWriterLeaseCallout = ({ holder, resource, waitedMs }: Props) => {
  const [isReleasing, setIsReleasing] = useState(false);
  const leases = useAppStore((state) => state.strandedWriterLeases);
  const refresh = useAppStore((state) => state.refreshStrandedWriterLeases);
  const release = useAppStore((state) => state.releaseStrandedWriterLease);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lease =
    leases.find(
      (candidate) => candidate.holder === holder && candidate.resources.includes(resource),
    ) ?? null;

  return (
    <TranscriptShell tone="warning" variant="boxed" emphasis className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <TriangleAlert
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('shrink-0 translate-y-0.5', warningTint.icon)}
        />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium leading-relaxed text-foreground">
              A writer lease on {resource} is stranded.
            </p>
            <p className="text-xs text-muted-foreground">
              {holder} held it, its process is gone, and this turn waited{' '}
              {Math.round(waitedMs / 1000)}s before giving up.
            </p>
          </div>
          {lease === null ? (
            <p className="text-xs text-muted-foreground">
              nothing stranded is recorded for it any more.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="warning"
                disabled={isReleasing}
                data-testid={`release-stranded-lease-${lease.id}`}
                onClick={() => {
                  setIsReleasing(true);
                  void release({
                    leaseId: lease.id,
                    releasedBy: 'the user',
                    releaseEvidence: `released from the transcript after ${holder} left ${resource} behind`,
                  }).finally(() => setIsReleasing(false));
                }}
              >
                {isReleasing ? 'Releasing' : 'Release the lease'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void refresh()}>
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>
    </TranscriptShell>
  );
};
