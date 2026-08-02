import { formatUsd } from '@goodboy/ui';
import type { BudgetAlert, BudgetAlertKind, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import type { GetFn } from './types';

type Params = {
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly get: GetFn;
};

type AlertParams = {
  readonly alert: BudgetAlert;
};

const SEVERITY_BY_KIND = {
  'provider-exceeded': 'error',
  'provider-threshold': 'warning',
  'session-exceeded': 'error',
  'session-threshold': 'warning',
} as const satisfies Record<BudgetAlertKind, 'error' | 'warning'>;

const subjectFor = ({ alert }: AlertParams): string => {
  const provider = alert.provider;
  if (provider == null) {
    return 'Session';
  }
  if (provider in PROVIDER_LABEL) {
    return PROVIDER_LABEL[provider as ProviderId];
  }
  return provider;
};

const titleFor = ({ alert }: AlertParams): string => {
  const subject = subjectFor({ alert });
  if (alert.kind === 'provider-exceeded' || alert.kind === 'session-exceeded') {
    return `${subject} budget cap reached`;
  }
  return `${subject} budget close to its cap`;
};

export const notifyBudgetAlerts = ({ alerts, get }: Params) => {
  for (const alert of alerts) {
    void get().emitNotification(
      'budget-cap',
      SEVERITY_BY_KIND[alert.kind],
      titleFor({ alert }),
      `${formatUsd(alert.currentUsd)} spent against a ${formatUsd(alert.capUsd)} cap.`,
      {
        ...(alert.sessionId != null && { sessionId: alert.sessionId }),
        action: { kind: 'open-budget', sessionId: alert.sessionId ?? null },
      },
    );
  }
};
