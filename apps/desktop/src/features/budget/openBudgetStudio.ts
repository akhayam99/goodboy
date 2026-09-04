import type { BudgetScope } from './components/BudgetStudio/lib';

type Params = {
  readonly scope?: BudgetScope;
};

export const openBudgetStudio = ({ scope }: Params) => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', { detail: { scope: 'budget', budgetScope: scope } }),
  );
};
