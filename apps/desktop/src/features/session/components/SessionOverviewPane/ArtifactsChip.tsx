import { Chip, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ArtifactsChip = ({ sessionId, onSelectLens }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const count = artifacts.filter((artifact) => artifact.status !== 'discarded').length;

  if (count === 0) {
    return null;
  }

  return (
    <Tooltip content="Reports, wireframes and plans this session wrote">
      <Chip
        as="button"
        tone="neutral"
        shape="badge"
        kind="reference"
        onClick={() => onSelectLens('plans')}
        icon={<CONCEPT_ICONS.artifacts size={11} aria-hidden className="text-muted-foreground" />}
        label="Artifacts"
        trailing={<span className="font-mono tabular-nums text-foreground">{count}</span>}
      />
    </Tooltip>
  );
};
