import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { autoLimitOpenEvent } from './autoLimitOpenEvent';
import { AutoTreeLimitPopover } from './AutoTreeLimitPopover';
import { useAutoTreeCap } from './useAutoTreeCap';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
  readonly triggerText?: string;
  readonly turns?: number | null;
};

export const AutoTreeLimitControl = ({
  sessionId,
  treeId,
  facts,
  triggerText,
  turns = null,
}: Props) => {
  const save = useAutoTreeCap({ sessionId, treeId });
  const hasSessionBudget = useAppStore(
    (state) => (state.sessionBudgets[sessionId]?.softCapUsd ?? null) !== null,
  );
  return (
    <AutoTreeLimitPopover
      facts={facts}
      {...(triggerText !== undefined && { triggerText })}
      turns={turns}
      isFromSession={hasSessionBudget}
      openEvent={autoLimitOpenEvent({ treeId })}
      onSave={save}
    />
  );
};
