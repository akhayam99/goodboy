import { AlertTriangle, Info, SearchX } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { LookupStatus } from '../../../integrations/issueCode/lookupCopy';

type Props = {
  readonly status: LookupStatus;
  readonly onAction: (status: LookupStatus) => void;
};

const ICON = { muted: SearchX, warning: AlertTriangle, info: Info } as const;

export const LookupStatusRow = ({ status, onAction }: Props) => {
  const Icon = ICON[status.tone];
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
      <span className="min-w-0 flex-1 text-muted-foreground">{status.text}</span>
      {status.action === null ? null : (
        <Button variant="ghost" size="sm" onClick={() => onAction(status)}>
          {status.action.label}
        </Button>
      )}
    </div>
  );
};
