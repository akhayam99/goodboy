import { MetaRow, PANE_RHYTHM, cn } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { ArtifactReportProvenance } from './ArtifactReportProvenance';
import { ArtifactScouts } from './ArtifactScouts';
import { ArtifactWireframeProvenance } from './ArtifactWireframeProvenance';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly creatorName: string;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
};

export const ArtifactDetailsPanel = ({
  sessionId,
  artifact,
  creatorName,
  agents,
  artifacts,
  onSelectArtifact,
}: Props) => (
  <div
    data-testid="artifact-details"
    className={cn('flex shrink-0 flex-col gap-2 pb-3', PANE_RHYTHM.inset)}
  >
    <MetaRow
      items={[
        <span
          key="creator"
          data-testid="artifact-creator"
          className="flex min-w-0 items-center gap-1.5"
        >
          <CONCEPT_ICONS.agents size={11} aria-hidden className="shrink-0 text-primary" />
          <span className="truncate">{creatorName}</span>
        </span>,
        <span key="kind">{artifact.kind}</span>,
        artifact.workflowRunId !== null ? (
          <span key="run">workflow run</span>
        ) : (
          <span key="run">standalone</span>
        ),
        <span key="revision">rev {artifact.revision}</span>,
        <span key="created" className="tabular-nums">
          {formatCompactDateTime({ iso: artifact.createdAt })}
        </span>,
      ]}
    />
    {artifact.kind === 'report' ? (
      <ArtifactReportProvenance
        sessionId={sessionId}
        artifact={artifact}
        agents={agents}
        artifacts={artifacts}
        onSelectArtifact={onSelectArtifact}
      />
    ) : null}
    {artifact.kind === 'wireframe' ? <ArtifactWireframeProvenance artifact={artifact} /> : null}
    <ArtifactScouts
      sessionId={sessionId}
      agentId={artifact.agentId}
      emptyLine="no scout read a repository for this one"
    />
  </div>
);
