import { RefreshCw } from 'lucide-react';
import { Button, cn, Skeleton } from '@goodboy/ui';
import type { QrInfo } from '../../bridge';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pairingBarTone, type PairingBarTone } from './pairingBarTone';

const BAR_TONE_CLASS = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
} as const satisfies Record<PairingBarTone, string>;

type Props = {
  readonly info: QrInfo | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly remaining: number;
  readonly total: number;
  readonly onMint: () => void;
};

export const PairingCode = ({ info, loading, error, remaining, total, onMint }: Props) => {
  if (loading && info === null) {
    return (
      <div
        className="flex flex-col items-center gap-3.5"
        role="status"
        aria-label="Generating pairing code"
      >
        <Skeleton className="size-[244px] rounded-lg" />
        <div className="flex w-[244px] flex-col items-center gap-1.5">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-24 rounded-sm" />
        </div>
      </div>
    );
  }
  if (error !== null) {
    return (
      <div className="flex size-[300px] flex-col items-center justify-center gap-3">
        <p className="text-center text-xs text-danger">{error}</p>
        <Button variant="secondary" size="sm" onClick={onMint}>
          <RefreshCw size={ICON_SIZE.row} aria-hidden /> Retry
        </Button>
      </div>
    );
  }
  if (info === null) {
    return null;
  }
  return (
    <>
      <div className="flex flex-col items-center gap-3.5">
        <div
          className="size-[244px] rounded-lg border border-border-soft bg-white p-3.5 shadow-lg [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: info.svg }}
        />
        <div className="flex w-[244px] flex-col items-center gap-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
            role="progressbar"
            aria-valuenow={remaining}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className={cn(
                'h-full rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 motion-safe:ease-linear',
                BAR_TONE_CLASS[pairingBarTone({ remaining, total })],
              )}
              style={{ width: `${(Math.min(remaining, total) / total) * 100}%` }}
            />
          </div>
          <span className="text-2xs font-semibold tabular-nums text-muted-foreground">
            Expires in {remaining}s
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <Button variant="secondary" size="sm" onClick={onMint}>
          <RefreshCw size={ICON_SIZE.row} aria-hidden /> New code
        </Button>
        <p className="max-w-[18rem] text-center text-2xs text-muted-foreground">
          A new code is minted automatically when this one expires.
        </p>
      </div>
    </>
  );
};
