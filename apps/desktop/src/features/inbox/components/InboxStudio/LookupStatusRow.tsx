import { AlertTriangle, Info, SearchX } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import type { LookupStatus } from '../../../integrations/issueCode/lookupCopy';

type Props = {
  readonly status: LookupStatus;
  readonly retryAt?: number | null;
  readonly onAction: (status: LookupStatus) => void;
};

const ICON = { muted: SearchX, warning: AlertTriangle, info: Info } as const;

const useCountdownSeconds = (target: number | null | undefined): number | null => {
  const now = useNow(1_000, target != null);
  return target == null ? null : Math.max(0, Math.ceil((target - now) / 1000));
};

export const LookupStatusRow = ({ status, retryAt, onAction }: Props) => {
  const Icon = ICON[status.tone];
  const secondsLeft = useCountdownSeconds(retryAt);
  const text =
    secondsLeft === null ? status.text : `${status.text} Trying again in ${secondsLeft}s.`;
  return (
    <div className="flex min-h-8 items-center gap-3 px-3 text-label">
      <Icon
        size={ICON_SIZE.row}
        aria-hidden
        className={cn(
          'shrink-0',
          status.tone === 'warning' ? 'text-warning' : 'text-faint-foreground',
        )}
      />
      <span className="min-w-0 flex-1 text-muted-foreground">{text}</span>
      {status.action === null ? null : (
        <Button variant="ghost" size="sm" onClick={() => onAction(status)}>
          {status.action.label}
        </Button>
      )}
    </div>
  );
};
