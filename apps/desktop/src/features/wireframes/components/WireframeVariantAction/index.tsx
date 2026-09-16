import { RotateCcw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WIREFRAME_FIDELITY_VARIANT_LABEL, type WireframeFidelity } from '../../wireframeFidelity';
import { useWireframeRespawn } from '../../useWireframeRespawn';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
};

export const WireframeVariantAction = ({ sessionId, artifact }: Props) => {
  const { fidelity, isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });
  const otherFidelity: WireframeFidelity = fidelity === 'low' ? 'high' : 'low';

  return (
    <span className="flex min-w-0 items-center gap-2">
      {error === null ? null : (
        <span
          role="alert"
          title={error}
          data-testid="wireframe-convert-error"
          className="max-w-32 truncate text-2xs text-danger"
        >
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => respawn({ fidelity: otherFidelity })}
        disabled={isRespawning}
        data-testid="wireframe-convert-fidelity"
        title={`Run the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherFidelity]}, leaving this one untouched`}
      >
        <RotateCcw size={ICON_SIZE.row} aria-hidden />
        {isRespawning ? 'Starting' : 'New variant'}
      </Button>
    </span>
  );
};
