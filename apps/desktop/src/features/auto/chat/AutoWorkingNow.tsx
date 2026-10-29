import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AutoWorkingChild } from './AutoWorkingChild';
import { useAutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
};

export const AutoWorkingNow = ({ sessionId, view }: Props) => {
  const { openChild } = useAutoTreeActions({ sessionId });
  const children = useMemo(
    () =>
      view.delegations
        .filter((delegation) => delegation.state === 'running' || delegation.state === 'starting')
        .reverse()
        .sort((left, right) => right.createdAt - left.createdAt),
    [view.delegations],
  );
  if (children.length === 0) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label="Working now"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <span className="shrink-0 text-meta text-muted-foreground">Working now</span>
      {children.map((delegation) => (
        <AutoWorkingChild
          key={delegation.id}
          delegation={delegation}
          onOpen={() => openChild(delegation.childAgentId)}
        />
      ))}
    </div>
  );
};
