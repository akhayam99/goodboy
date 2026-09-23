import { formatUsd, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { TriangleAlert, X } from 'lucide-react';
import type { BudgetAlert } from '@goodboy/types';
import { providerLabel } from './lib';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly onDismiss: (id: string) => void;
};

type AlertMessageParams = {
  readonly alert: BudgetAlert;
};

const alertMessage = ({ alert }: AlertMessageParams): string => {
  const who =
    alert.provider === undefined ? 'This session' : providerLabel({ provider: alert.provider });
  const usage = `${formatUsd(alert.currentUsd)} of ${formatUsd(alert.capUsd)}`;
  switch (alert.kind) {
    case 'provider-exceeded':
    case 'session-exceeded':
      return `${who} exceeded its cap (${usage})`;
    case 'provider-threshold':
    case 'session-threshold':
      return `${who} is nearing its cap (${usage})`;
    default: {
      const exhaustive: never = alert.kind;
      return exhaustive;
    }
  }
};

export const AlertBanner = ({ alerts, onDismiss }: Props) => {
  const active = alerts.filter((a) => a.dismissedAt === undefined);
  if (active.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {active.map((alert) => {
        const exceeded = alert.kind === 'provider-exceeded' || alert.kind === 'session-exceeded';
        return (
          <li
            key={alert.id}
            className={
              exceeded
                ? cn(
                    'flex items-center gap-2.5 rounded-lg border',
                    tintClasses('danger').borderSoft,
                    tintClasses('danger').bg,
                    'px-3 py-2',
                  )
                : cn(
                    'flex items-center gap-2.5 rounded-lg border',
                    tintClasses('warning').borderSoft,
                    tintClasses('warning').bg,
                    'px-3 py-2',
                  )
            }
          >
            <TriangleAlert
              size={ICON_SIZE.control}
              aria-hidden
              className={exceeded ? 'shrink-0 text-danger' : 'shrink-0 text-warning'}
            />
            <span className="flex-1 text-xs text-foreground">{alertMessage({ alert })}</span>
            <Tooltip content="Dismiss alert">
              <button
                type="button"
                onClick={() => onDismiss(alert.id)}
                aria-label="Dismiss alert"
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <X size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
};
