import { useEffect, useState } from 'react';
import { AlertTriangle, Info, SearchX } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { LookupStatus } from '../../../integrations/issueCode/lookupCopy';

type Props = {
  readonly status: LookupStatus;
  readonly retryAt?: number | null;
  readonly onAction: (status: LookupStatus) => void;
};

const ICON = { muted: SearchX, warning: AlertTriangle, info: Info } as const;

const useCountdownSeconds = (target: number | null | undefined): number | null => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target == null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return target == null ? null : Math.max(0, Math.ceil((target - now) / 1000));
};

export const LookupStatusRow = ({ status, retryAt, onAction }: Props) => {
  const Icon = ICON[status.tone];
  const secondsLeft = useCountdownSeconds(retryAt);
  const text =
    secondsLeft === null ? status.text : `${status.text} Trying again in ${secondsLeft}s.`;
  return (
    <div className="flex min-h-8 items-center gap-2.5 px-2.5 text-label">
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
