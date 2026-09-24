import { MetaRow, RailCard } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { ArtifactStatusChip } from './ArtifactStatusChip';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

type Props = {
  readonly artifact: SessionArtifact;
  readonly onSelect: () => void;
};

export const ArtifactRow = ({ artifact, onSelect }: Props) => (
  <RailCard
    title={artifact.title}
    muted={artifact.status === 'discarded'}
    status={<ArtifactStatusChip kind={artifact.kind} status={artifact.status} />}
    meta={
      <MetaRow
        items={[
          <span key="revision">rev {artifact.revision}</span>,
          <span key="created" className="tabular-nums">
            {formatCompactDateTime({ iso: artifact.createdAt })}
          </span>,
        ]}
      />
    }
    onSelect={onSelect}
  />
);
