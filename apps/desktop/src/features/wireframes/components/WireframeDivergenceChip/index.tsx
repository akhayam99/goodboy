import type { WireframeArtifact } from '@goodboy/types';
import { asWireframeFidelity, requestedWireframeFidelity } from '../../wireframeFidelity';

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
    <span
      data-testid="wireframe-fidelity-divergence"
      title={`this wireframe was asked for at ${requested} fidelity and came back at ${fidelity}`}
      className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-2xs uppercase tracking-wide text-warning"
    >
      {requested} asked, {fidelity} produced
    </span>
  );
};
