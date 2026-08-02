import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { extractPlanFromMarker } from '@goodboy/core';
import { useSessionPlans } from '../../../../store';
import { TranscriptShell } from '../TranscriptShell';
import { tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const accent = tintClasses('primary');

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

export const PlanChip = ({ assistantText, sessionId }: Props) => {
  const plan = useMemo(() => extractPlanFromMarker(assistantText), [assistantText]);
  const plans = useSessionPlans(sessionId);

  if (!plan) {
    return null;
  }

  const resolved = plans.find((p) => p.title === plan.title) ?? plans[plans.length - 1] ?? null;

  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-plan-studio', {
        detail: { sessionId, ...(resolved ? { planId: resolved.id } : {}) },
      }),
    );
  };

  return (
    <TranscriptShell
      as="button"
      type="button"
      onClick={onClick}
      data-testid="plan-chip"
      tone="primary"
      variant="pill"
      className={`inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${accent.text}`}
    >
      <CONCEPT_ICONS.plans size={12} aria-hidden />
      <span>{plan.title}</span>
    </TranscriptShell>
  );
};
