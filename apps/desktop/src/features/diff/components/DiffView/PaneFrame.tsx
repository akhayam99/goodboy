import type { ReactNode, RefObject } from 'react';
import { PageColumn, ScrollFade } from '@goodboy/ui';

type Props = {
  readonly isSplit: boolean;
  readonly columnWidth: 'column' | 'full';
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly head: ReactNode;
  readonly children: ReactNode;
};

export const PaneFrame = ({ isSplit, columnWidth, viewportRef, head, children }: Props) => (
  <div data-slot="diff-view" className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-col">
      {isSplit ? (
        head
      ) : (
        <PageColumn width={columnWidth} className="flex flex-col gap-3 pb-3">
          {head}
        </PageColumn>
      )}
    </div>
    <ScrollFade className="min-h-0 flex-1" viewportRef={viewportRef} fadeSize={24} fadeEdges="end">
      {isSplit ? (
        <div className="pl-4 pr-6">{children}</div>
      ) : (
        <PageColumn width={columnWidth}>{children}</PageColumn>
      )}
    </ScrollFade>
  </div>
);
