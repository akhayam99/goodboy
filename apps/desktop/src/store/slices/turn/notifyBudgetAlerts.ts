import { formatUsd } from '@goodboy/ui';
import type { BudgetAlert, BudgetAlertKind, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { sessionTitle } from '../../../features/session/sessionTitle';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

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

const providerName = ({ alert }: AlertParams): string => {
  const provider = alert.provider ?? '';
  if (provider in PROVIDER_LABEL) {
    return PROVIDER_LABEL[provider as ProviderId];
  }
  return provider;
};

type TitleParams = AlertParams & {
  readonly get: GetFn;
};

const sessionTitleFor = ({ alert, get }: TitleParams): string => {
  const state = get();
  const session = sessionById(state.sessions, alert.sessionId) ?? null;
  const name = sessionTitle({ session });
  const limit = formatUsd(alert.capUsd);
  if (alert.kind === 'session-threshold') {
    return `${name} is close to its ${limit} spend limit.`;
  }
  const onExceed =
    alert.sessionId == null
      ? 'pause'
      : (state.sessionBudgets[alert.sessionId]?.onExceed ?? 'pause');
  return onExceed === 'warn'
    ? `${name} passed its ${limit} spend limit.`
    : `${name} paused its workflows at the ${limit} spend limit.`;
};

const titleFor = ({ alert, get }: TitleParams): string => {
  if (alert.provider == null) {
    return sessionTitleFor({ alert, get });
  }
  const subject = providerName({ alert });
  if (alert.kind === 'provider-exceeded' || alert.kind === 'session-exceeded') {
    return `${subject} budget cap reached`;
  }
  return `${subject} budget close to its cap`;
};

type BodyParams = AlertParams;

const bodyFor = ({ alert }: BodyParams): string =>
  alert.provider == null
    ? `${formatUsd(alert.currentUsd)} spent so far.`
    : `${formatUsd(alert.currentUsd)} spent against a ${formatUsd(alert.capUsd)} cap.`;

export const notifyBudgetAlerts = ({ alerts, get }: Params) => {
  for (const alert of alerts) {
    void get().emitNotification({
      kind: 'budget-cap',
      severity: SEVERITY_BY_KIND[alert.kind],
      title: titleFor({ alert, get }),
      body: bodyFor({ alert }),
      ...(alert.sessionId != null && { sessionId: alert.sessionId }),
      action: { kind: 'open-budget', sessionId: alert.sessionId ?? null },
    });
  }
};
