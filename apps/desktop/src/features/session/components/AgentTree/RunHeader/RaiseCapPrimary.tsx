import { Wallet } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { BudgetAlert, Session } from '@goodboy/types';

import { useAppStore } from '../../../../../store';
import { requestSessionSpendLimitEdit } from '../../../../budget/requestSessionSpendLimitEdit';
import { isBudgetBlocked } from '../../../../../store/slices/workflows/budgetBlock';
import type { RunView } from '../useRunView';
import type { RunPrimaryVariant } from './RunPrimaryAction';
import { RunSpendLimitPopover } from '../../../../workflows/components/RunSpendLimitPopover';

const EMPTY_ALERTS: ReadonlyArray<BudgetAlert> = [];

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly variant: RunPrimaryVariant;
};

export const RaiseCapPrimary = ({ session, view, variant }: Props) => {
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
      variant={variant}
      onClick={() => requestSessionSpendLimitEdit({ sessionId: session.id })}
    >
      <Wallet size={ICON_SIZE.control} aria-hidden />
      Raise limit
    </Button>
  ) : (
    <RunSpendLimitPopover
      sessionId={session.id}
      run={view.run}
      variant="primary"
      buttonVariant={variant}
    />
  );
};
