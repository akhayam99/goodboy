import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { extractPlanFromMarker } from '@goodboy/core';
import { useSessionPlans } from '../../../../store';
import { TranscriptShell } from '../TranscriptShell';
import { ICON_SIZE, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';

const accent = tintClasses(CONCEPT_TONE.plans);

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
    dispatchWindowEvent({
      name: 'goodboy:open-plan-studio',
      detail: { sessionId, ...(resolved ? { planId: resolved.id } : {}) },
    });
  };

  return (
    <TranscriptShell
      as="button"
      type="button"
      onClick={onClick}
      data-testid="plan-chip"
      tone={CONCEPT_TONE.plans}
      variant="pill"
      className={`inline-flex w-fit items-center gap-2 text-meta font-medium transition-opacity hover:opacity-80 ${accent.text}`}
    >
      <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden />
      <span>{plan.title}</span>
    </TranscriptShell>
  );
};
