import { Wallet } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { BudgetAlert, Session } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../../store';
import { requestSessionSpendLimitEdit } from '../../../../budget/requestSessionSpendLimitEdit';
import { isBudgetBlocked } from '../../../../../store/slices/workflows/budgetBlock';
import type { RunView } from '../useRunView';
import { RunSpendLimitPopover } from '../../../../workflows/components/RunSpendLimitPopover';

const EMPTY_ALERTS: ReadonlyArray<BudgetAlert> = [];

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RaiseCapPrimary = ({ session, view }: Props) => {
  const isSessionBlocked = useAppStore((state) =>
    isBudgetBlocked({
      alerts: state.budgetAlerts ?? EMPTY_ALERTS,
      budgets: state.sessionBudgets,
      sessionId: session.id,
    }),
  );

  return isSessionBlocked ? (
    <Button
      size="sm"
      variant="primary"
      onClick={() => requestSessionSpendLimitEdit({ sessionId: session.id })}
    >
      <Wallet size={ICON_SIZE.control} aria-hidden />
      Raise spend cap
    </Button>
  ) : (
    <RunSpendLimitPopover sessionId={session.id} run={view.run} variant="primary" />
  );
};
