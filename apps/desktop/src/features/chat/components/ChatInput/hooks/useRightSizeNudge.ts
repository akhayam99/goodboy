import { useEffect, useMemo, useState } from 'react';
import { assessTurnWeight } from '@goodboy/core';
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

type UseRightSizeNudgeArgs = {
  readonly isFirstTurnForAgent: boolean;
  readonly value: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly effectiveModel: string;
  readonly modelCandidates: ReadonlyArray<string>;
  readonly allowOverride: boolean;
};

export function useRightSizeNudge({
  isFirstTurnForAgent,
  value,
  attachments,
  effectiveModel,
  modelCandidates,
  allowOverride,
}: UseRightSizeNudgeArgs) {
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);

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

  const checkAndInterceptRightSize = (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
  ): boolean => {
    if (!allowOverride || rightSizeSuggestion === null || rightSizePending !== null) return false;
    setRightSizePending({ content, attachments: atts });
    return true;
  };

  return {
    rightSizePending,
    setRightSizePending,
    rightSizeDismissed,
    setRightSizeDismissed,
    rightSizeSuggestion,
    checkAndInterceptRightSize,
  };
}
