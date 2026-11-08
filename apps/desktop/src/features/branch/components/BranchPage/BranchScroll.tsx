import { useRef, type ReactNode } from 'react';
import { ScrollFade, useScrollMemory } from '@goodboy/ui';
import type { PullRequestView, SessionId } from '@goodboy/types';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type Props = {
  readonly sessionId: SessionId;
  readonly tab: BranchTab;
  readonly view: PullRequestView | null;
  readonly isLoaded?: boolean;
  readonly children: ReactNode;
};

export const BranchScroll = ({ sessionId, tab, view, isLoaded = true, children }: Props) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const onScroll = useScrollMemory({
    memoryKey: `${sessionId}|branch:${tab}`,
    isLoaded: isLoaded && (tab !== 'pr' || view !== null),
    viewportRef,
  });
  return (
    <ScrollFade
      className="min-h-0 flex-1"
      fadeSize={24}
      viewportRef={viewportRef}
      onViewportScroll={onScroll}
    >
      {children}
    </ScrollFade>
  );
};
