import { IconButton, Notice, formatUsd } from '@goodboy/ui';
import { X } from 'lucide-react';
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

const alertTitle = ({ alert }: AlertMessageParams): string => {
  const who =
    alert.provider === undefined ? 'This session' : providerLabel({ provider: alert.provider });
  switch (alert.kind) {
    case 'provider-exceeded':
    case 'session-exceeded':
      return `${who} exceeded its cap`;
    case 'provider-threshold':
    case 'session-threshold':
      return `${who} is nearing its cap`;
    default: {
      const exhaustive: never = alert.kind;
      return exhaustive;
    }
  }
};

const isExceeded = ({ alert }: AlertMessageParams): boolean =>
  alert.kind === 'provider-exceeded' || alert.kind === 'session-exceeded';

export const AlertBanner = ({ alerts, onDismiss }: Props) => {
  const active = alerts.filter((a) => a.dismissedAt === undefined);
  if (active.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {active.map((alert) => (
        <li key={alert.id}>
          <Notice
            tone={isExceeded({ alert }) ? 'danger' : 'warning'}
            placement="banner"
            title={alertTitle({ alert })}
            body={
              <span className="tabular-nums">{`${formatUsd(alert.currentUsd)} of ${formatUsd(alert.capUsd)}`}</span>
            }
            actions={
              <IconButton
                icon={X}
                label="Dismiss alert"
                variant="ghost"
                iconSize={ICON_SIZE.row}
                className="-my-1 p-1"
                onClick={() => onDismiss(alert.id)}
              />
            }
          />
        </li>
      ))}
    </ul>
  );
};
