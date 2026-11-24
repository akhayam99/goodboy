import type { ReactNode } from 'react';
import { Button, StatusDot } from '@goodboy/ui';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly state: 'read' | 'queued' | 'reading';
  readonly step: number | null;
  readonly onOpenStep: (() => void) | null;
};

const bylineStatusOf = ({ state, step, onOpenStep }: Props): ReactNode => {
  if (state === 'reading') {
    return (
      <span className="flex items-center gap-1">
        <StatusDot tone="info" size="sm" pulsing />
        {ORCHESTRATED_COPY.hintReading}
      </span>
    );
  }
  if (state === 'queued') {
    return <span>{ORCHESTRATED_COPY.hintNotRead}</span>;
  }
  if (step === null) {
    return <span>{ORCHESTRATED_COPY.hintRead}</span>;
  }
  if (onOpenStep === null) {
    return <span>{ORCHESTRATED_COPY.readHint({ step })}</span>;
  }
  return (
    <Button
      variant="quiet"
      size="xs"
      className="shrink-0"
      onClick={onOpenStep}
      data-hint-step-link=""
      data-hint-control="step"
    >
      {ORCHESTRATED_COPY.readHint({ step })}
    </Button>
  );
};

export const OrchestratedHintByline = ({ state, step, onOpenStep }: Props) => (
  <span data-hint-byline="" className="flex items-center gap-1">
    <span>{ORCHESTRATED_COPY.hintBy}</span>
    <span aria-hidden>·</span>
    {bylineStatusOf({ state, step, onOpenStep })}
  </span>
);
