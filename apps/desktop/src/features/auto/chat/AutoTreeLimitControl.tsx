import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { AutoTreeLimitPopover } from './AutoTreeLimitPopover';
import { useAutoTreeCap } from './useAutoTreeCap';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
};

export const AutoTreeLimitControl = ({ sessionId, treeId, facts }: Props) => {
  const save = useAutoTreeCap({ sessionId, treeId });
  const hasSessionBudget = useAppStore(
    (state) => (state.sessionBudgets[sessionId]?.softCapUsd ?? null) !== null,
  );
  return <AutoTreeLimitPopover facts={facts} isFromSession={hasSessionBudget} onSave={save} />;
};
