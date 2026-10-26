import { useEffect, useMemo, useState } from 'react';
import { assessTurnWeight } from '@goodboy/core';
import type { NudgeOutcome } from '@goodboy/db';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { suggestHeavierModel, suggestLighterModel } from '../../../utils/chat-constants';
import type { PendingAttachment } from '../../../../attachments/pendingAttachment';

export type RightSizeSuggestion = {
  readonly direction: 'lighter' | 'heavier';
  readonly model: string;
  readonly kind: 'strong' | 'optional';
  readonly costMultiplier: number | null;
};

export type RightSizePending = {
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
};

type OutcomeParams = {
  readonly outcome: NudgeOutcome;
};

type Params = {
  readonly sessionId: SessionId;
  readonly isFirstTurnForAgent: boolean;
  readonly value: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly effectiveProvider: ProviderId;
  readonly effectiveModel: string;
  readonly modelCandidates: ReadonlyArray<string>;
  readonly allowOverride: boolean;
};

export const useRightSizeNudge = ({
  sessionId,
  isFirstTurnForAgent,
  value,
  attachments,
  effectiveProvider,
  effectiveModel,
  modelCandidates,
  allowOverride,
}: Params) => {
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  const [rightSizeNudgeEventId, setRightSizeNudgeEventId] = useState<string | null>(null);
  const recordNudgeShown = useAppStore((s) => s.recordNudgeShown);
  const recordNudgeOutcome = useAppStore((s) => s.recordNudgeOutcome);

  const rightSizeSuggestion = useMemo<RightSizeSuggestion | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) {
      return null;
    }
    const weight = assessTurnWeight(value, { attachmentCount: attachments.length });
    if (weight === 'light') {
      const s = suggestLighterModel({
        provider: effectiveProvider,
        current: effectiveModel,
        candidates: modelCandidates,
      });
      return s !== null
        ? { direction: 'lighter', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    if (weight === 'heavy') {
      const s = suggestHeavierModel({
        provider: effectiveProvider,
        current: effectiveModel,
        candidates: modelCandidates,
      });
      return s !== null
        ? { direction: 'heavier', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    return null;
  }, [
    isFirstTurnForAgent,
    rightSizeDismissed,
    value,
    effectiveProvider,
    effectiveModel,
    modelCandidates,
    attachments,
  ]);

  useEffect(() => {
    if (rightSizePending !== null && rightSizeSuggestion === null) {
      setRightSizePending(null);
    }
  }, [rightSizePending, rightSizeSuggestion]);

  const recordRightSizeOutcome = async ({ outcome }: OutcomeParams) => {
    if (rightSizeNudgeEventId === null) {
      return;
    }
    await recordNudgeOutcome({ id: rightSizeNudgeEventId, outcome });
    setRightSizeNudgeEventId(null);
  };

  const checkAndInterceptRightSize = async (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
  ): Promise<boolean> => {
    if (!allowOverride || rightSizeSuggestion === null || rightSizePending !== null) {
      return false;
    }

    const id = await recordNudgeShown({
      sessionId,
      kind: 'model-rightsize',
      context: {
        sessionId,
        from: effectiveModel,
        to: rightSizeSuggestion.model,
        direction: rightSizeSuggestion.direction,
      },
    });
    setRightSizeNudgeEventId(id);

    setRightSizePending({ content, attachments: atts });
    return true;
  };

  return {
    rightSizePending,
    setRightSizePending,
    rightSizeDismissed,
    setRightSizeDismissed,
    rightSizeSuggestion,
    rightSizeNudgeEventId,
    setRightSizeNudgeEventId,
    recordRightSizeOutcome,
    checkAndInterceptRightSize,
  };
};
