import { useEffect, useRef, useState } from 'react';
import { resetAdvice } from '@goodboy/core';
import { BAND_ROW_CLASS, Button, cn } from '@goodboy/ui';
import { Gift } from 'lucide-react';
import { useAppStore } from '../../../../../../../store';
import { ICON_SIZE } from '../../../../../../../shared/components/conceptIcons';
import { countLabel, expiryLine } from './resetCopy';
import { ResetConfirm } from './ResetConfirm';
import { ResetOutcomeNotice, type ResetOutcomeKind } from './ResetOutcomeNotice';
import { ResetStrongStop } from './ResetStrongStop';

type Props = {
  readonly nowMs: number;
};

type Phase = 'idle' | 'confirm' | 'busy';

export const ResetCreditRow = ({ nowMs }: Props) => {
  const credits = useAppStore((state) => state.codexResetCredits);
  const limits = useAppStore((state) => state.providerLimits.codex ?? null);
  const consume = useAppStore((state) => state.consumeCodexResetCredit);
  const refreshCodexLimits = useAppStore((state) => state.refreshCodexLimits);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<ResetOutcomeKind | null>(null);
  const [usedAtMs, setUsedAtMs] = useState(nowMs);
  const askedDetailsRef = useRef(false);
  const count = credits?.availableCount ?? 0;

  useEffect(() => {
    if (askedDetailsRef.current || count === 0 || credits?.creditId != null) {
      return;
    }
    askedDetailsRef.current = true;
    void refreshCodexLimits({ withResetDetails: true });
  }, [count, credits?.creditId, refreshCodexLimits]);

  const run = async () => {
    setPhase('busy');
    setUsedAtMs(Date.now());
    const result = await consume();
    setOutcome(result);
    setPhase(result === 'failed' ? 'confirm' : 'idle');
  };

  const notice =
    outcome === null ? null : (
      <ResetOutcomeNotice outcome={outcome} usedAtMs={usedAtMs} onRetry={() => void run()} />
    );

  if (phase !== 'idle' && count > 0) {
    const advice = resetAdvice({ limits, nowMs });
    const isBusy = phase === 'busy';
    const cancel = () => {
      setPhase('idle');
      setOutcome(null);
    };
    return (
      <div className="flex flex-col gap-2">
        {outcome === 'failed' ? notice : null}
        {advice.strong ? (
          <ResetStrongStop
            advice={advice}
            count={count}
            nowMs={nowMs}
            isBusy={isBusy}
            onKeep={cancel}
            onConfirm={() => void run()}
          />
        ) : (
          <ResetConfirm
            advice={advice}
            nowMs={nowMs}
            isBusy={isBusy}
            onCancel={cancel}
            onConfirm={() => void run()}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {notice}
      {count > 0 ? (
        <div className={cn(BAND_ROW_CLASS, 'gap-3 bg-selected text-label')}>
          <Gift size={ICON_SIZE.control} aria-hidden className="shrink-0 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground">{countLabel({ count })}</span>
            <span className="truncate text-meta text-muted-foreground">
              {expiryLine({ expiresAt: credits?.expiresAt ?? null })}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOutcome(null);
              setPhase('confirm');
            }}
          >
            Use reset
          </Button>
        </div>
      ) : null}
    </>
  );
};
