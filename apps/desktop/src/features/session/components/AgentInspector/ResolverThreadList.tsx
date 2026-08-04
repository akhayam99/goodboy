import type { PrComment } from '@goodboy/types';
import type { ResolverActionKind } from '../../resolverActions';
import type { ResolverRunningThreadAction } from '../../hooks/useResolverActions';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { ResolverPanelSection } from './ResolverPanelSection';
import { ResolverThreadRow } from './ResolverThreadRow';

type Props = {
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
  readonly commentByThreadId: ReadonlyMap<string, PrComment>;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
  readonly runningThreadAction: ResolverRunningThreadAction | null;
  readonly onRun: (params: {
    readonly threadId: string;
    readonly kind: ResolverActionKind;
    readonly text: string;
  }) => Promise<void>;
  readonly onReplyChange: (params: { readonly threadId: string; readonly reply: string }) => void;
  readonly onOpenThread: ((threadId: string) => void) | null;
};

export const ResolverThreadList = ({
  settlements,
  commentByThreadId,
  prNumber,
  isBusy,
  canAct,
  runningThreadAction,
  onRun,
  onReplyChange,
  onOpenThread,
}: Props) => {
  if (settlements.length === 0) {
    return null;
  }

  return (
    <ResolverPanelSection label={settlements.length > 1 ? 'Threads' : 'Thread'}>
      <ul className="flex flex-col gap-2">
        {settlements.map((settlement, index) => (
          <ResolverThreadRow
            key={settlement.threadId}
            settlement={settlement}
            comment={commentByThreadId.get(settlement.threadId) ?? null}
            position={index + 1}
            prNumber={prNumber}
            isBusy={isBusy}
            canAct={canAct}
            canForceResolve={settlements.length > 1}
            runningThreadAction={runningThreadAction}
            onRun={onRun}
            onReplyChange={onReplyChange}
            onOpenThread={onOpenThread}
          />
        ))}
      </ul>
    </ResolverPanelSection>
  );
};
