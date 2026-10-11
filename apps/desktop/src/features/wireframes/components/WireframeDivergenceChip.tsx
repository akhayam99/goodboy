import { cn, tintClasses, Eyebrow, Tooltip } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { asWireframeFidelity, requestedWireframeFidelity } from '../wireframeFidelity';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly creatorName: string | null;
};

export const WireframeDivergenceChip = ({ artifact, creatorName }: Props) => {
  const requested = requestedWireframeFidelity({ agentName: creatorName });
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';

  if (requested === null || requested === fidelity) {
    return null;
  }

  return (
    <Tooltip
      content={`this wireframe was asked for at ${requested} fidelity and came back at ${fidelity}`}
    >
      <span
        data-testid="wireframe-fidelity-divergence"
        className={cn('shrink-0 rounded-sm', tintClasses('warning').bg, 'px-2 py-0.5')}
      >
        <Eyebrow label={`${requested} asked, ${fidelity} produced`} className="text-warning" />
      </span>
    </Tooltip>
  );
};
