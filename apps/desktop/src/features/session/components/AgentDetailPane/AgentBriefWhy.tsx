import { ClampedProse, SectionSurface } from '@goodboy/ui';
import type { Step } from '@goodboy/types';

type Props = {
  readonly step: Step | null;
};

export const AgentBriefWhy = ({ step }: Props) => {
  const reason = step?.orchestratorReason?.trim() ?? '';
  if (reason === '') {
    return null;
  }
  return (
    <SectionSurface label="Why this step" ariaLabel="Why this step">
      <ClampedProse text={reason} lines={3} className="text-sm leading-relaxed text-foreground" />
    </SectionSurface>
  );
};
