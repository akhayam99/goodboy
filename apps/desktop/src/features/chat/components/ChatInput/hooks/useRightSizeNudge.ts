import { useEffect, useMemo, useState } from 'react';
import { assessTurnWeight } from '@goodboy/core';
import { insertNudgeEvent, updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../../shared/lib/db';
import { suggestHeavierModel, suggestLighterModel } from '../../../utils/chat-constants';
import type { PendingAttachment } from '../lib';

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
  readonly effectiveModel: string;
  readonly modelCandidates: ReadonlyArray<string>;
  readonly allowOverride: boolean;
};

export const useRightSizeNudge = ({
  sessionId,
  isFirstTurnForAgent,
  value,
  attachments,
  effectiveModel,
  modelCandidates,
  allowOverride,
}: Params) => {
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  const [rightSizeNudgeEventId, setRightSizeNudgeEventId] = useState<string | null>(null);

  const rightSizeSuggestion = useMemo<RightSizeSuggestion | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) return null;
    const weight = assessTurnWeight(value, { attachmentCount: attachments.length });
    if (weight === 'light') {
      const s = suggestLighterModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'lighter', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    if (weight === 'heavy') {
      const s = suggestHeavierModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'heavier', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    return null;
  }, [
    isFirstTurnForAgent,
    rightSizeDismissed,
    value,
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
    try {
      await updateNudgeEventOutcome(
        tauriDatabase,
        rightSizeNudgeEventId,
        outcome,
        new Date().toISOString() as IsoDateTime,
      );
    } catch {
      setRightSizeNudgeEventId(null);
      return;
    }
    setRightSizeNudgeEventId(null);
  };

  const checkAndInterceptRightSize = async (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
  ): Promise<boolean> => {
    if (!allowOverride || rightSizeSuggestion === null || rightSizePending !== null) return false;

    const id = crypto.randomUUID();
    try {
      await insertNudgeEvent(tauriDatabase, {
        id,
        ts: new Date().toISOString() as IsoDateTime,
        kind: 'model-rightsize',
        contextJson: JSON.stringify({
          sessionId,
          from: effectiveModel,
          to: rightSizeSuggestion.model,
          direction: rightSizeSuggestion.direction,
        }),
        outcome: null,
        outcomeTs: null,
      });
      setRightSizeNudgeEventId(id);
    } catch {
      setRightSizeNudgeEventId(null);
    }

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
