import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import type { BudgetScope } from '../../../budget/components/BudgetStudio/lib';

export type SettingsScope = 'app' | 'workspace' | 'providers' | 'budget';

export type SettingsFocus = {
  readonly scope: SettingsScope;
  readonly section?: string;
  readonly provider?: ProviderId;
  readonly action?: ProviderLifecycleAction;
  readonly budgetScope?: BudgetScope;
};
