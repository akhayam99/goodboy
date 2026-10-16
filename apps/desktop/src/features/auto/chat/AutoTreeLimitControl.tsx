import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { AutoTreeLimitPopover } from './AutoTreeLimitPopover';
import { useAutoTreeCap } from './useAutoTreeCap';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
};

export const AutoTreeLimitControl = ({ sessionId, treeId, facts }: Props) => {
  const save = useAutoTreeCap({ sessionId, treeId });
  return <AutoTreeLimitPopover facts={facts} onSave={save} />;
};
