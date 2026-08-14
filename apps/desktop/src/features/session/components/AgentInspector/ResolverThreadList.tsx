import type { PrComment } from '@goodboy/types';
import type { ResolverActionKind } from '../../resolverActions';
import type { ResolverMissingVerdicts } from '../../resolverMissingVerdicts';
import type { ResolverRunningThreadAction } from '../../hooks/useResolverActions';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { ResolverMissingVerdictsNotice } from './ResolverMissingVerdictsNotice';
import { ResolverPanelSection } from './ResolverPanelSection';
import { ResolverThreadCard } from './ResolverThreadCard';

type Props = {
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
  readonly commentByThreadId: ReadonlyMap<string, PrComment>;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
  readonly actLockReason: string | null;
  readonly missingVerdicts: ResolverMissingVerdicts | null;
  readonly runningThreadAction: ResolverRunningThreadAction | null;
  readonly isAskingForVerdicts: boolean;
  readonly onRun: (params: {
    readonly threadId: string;
    readonly kind: ResolverActionKind;
    readonly text: string;
    readonly notes: string;
  }) => Promise<void>;
  readonly onAskForVerdicts: () => void;
  readonly onReplyChange: (params: { readonly threadId: string; readonly reply: string }) => void;
  readonly onOpenThread: ((threadId: string) => void) | null;
};

export const ResolverThreadList = ({
  settlements,
  commentByThreadId,
  prNumber,
  isBusy,
  canAct,
  actLockReason,
  missingVerdicts,
  runningThreadAction,
  isAskingForVerdicts,
  onRun,
  onAskForVerdicts,
  onReplyChange,
  onOpenThread,
}: Props) => {
  if (settlements.length === 0) {
    return null;
  }

  return (
    <ResolverPanelSection label={settlements.length > 1 ? 'Threads' : 'Thread'}>
      {missingVerdicts !== null && (
        <ResolverMissingVerdictsNotice
          missing={missingVerdicts}
          isBusy={isAskingForVerdicts}
          onAsk={onAskForVerdicts}
        />
      )}
      <ul className="flex flex-col gap-2">
        {settlements.map((settlement, index) => (
          <ResolverThreadCard
            key={settlement.threadId}
            settlement={settlement}
            comment={commentByThreadId.get(settlement.threadId) ?? null}
            position={index + 1}
            prNumber={prNumber}
            isBusy={isBusy}
            canAct={canAct}
            actLockReason={actLockReason}
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
