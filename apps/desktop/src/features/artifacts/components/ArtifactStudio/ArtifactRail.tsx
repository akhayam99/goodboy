import { MetaRow, RailCard } from '@goodboy/ui';
import type { ArtifactId, ArtifactKind, SessionArtifact } from '@goodboy/types';
import { ARTIFACT_KIND_LABEL } from '../../artifact-status';
import { ArtifactStatusChip } from './ArtifactStatusChip';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

type Props = {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly onSelect: (artifactId: ArtifactId) => void;
};

const KIND_ORDER: ReadonlyArray<ArtifactKind> = ['report', 'wireframe'];

export const ArtifactRail = ({ artifacts, onSelect }: Props) => {
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    rows: artifacts.filter((artifact) => artifact.kind === kind),
  })).filter((group) => group.rows.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="artifact-rail">
      {groups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-2">
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {ARTIFACT_KIND_LABEL[group.kind]}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.rows.map((artifact) => (
              <li key={artifact.id}>
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
                  onSelect={() => onSelect(artifact.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
