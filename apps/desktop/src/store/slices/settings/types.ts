export type { SetFn, GetFn } from '../../slice-types';

export type SystemAlertKind = 'audit-retry-corrupt' | 'audit-retry-exhausted' | 'context-soft-cap';

export interface SystemAlert {
  readonly id: string;
  readonly kind: SystemAlertKind;
  readonly message: string;
  readonly createdAt: string;
}
