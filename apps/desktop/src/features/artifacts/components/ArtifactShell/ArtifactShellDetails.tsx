import { MetaRow, SectionHeader } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../artifactPresentation';
import { ArtifactBuiltFrom } from '../ArtifactStudio/ArtifactBuiltFrom';
import { ArtifactReportProvenance } from '../ArtifactStudio/ArtifactReportProvenance';
import { ArtifactScouts } from '../ArtifactStudio/ArtifactScouts';
import { ArtifactWireframeProvenance } from '../ArtifactStudio/ArtifactWireframeProvenance';
import { useArtifactSavedCopy } from '../../hooks/useArtifactSavedCopy';
import { ArtifactPlanRuns } from './ArtifactPlanRuns';
import { ArtifactSavedCopy } from './ArtifactSavedCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
};

export const ArtifactShellDetails = ({ sessionId, artifact, agents, artifacts }: Props) => {
  const setFocusedArtifactId = useAppStore((s) => s.setFocusedArtifactId);
  const navigate = useAppStore((s) => s.navigate);
  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const openArtifact = (artifactId: ArtifactId) => setFocusedArtifactId(sessionId, artifactId);
  const savedCopy = useArtifactSavedCopy({ sessionId, artifact });

  return (
    <div data-testid="artifact-details" className="flex min-w-0 flex-col gap-5">
      <section aria-label="Made by" className="flex min-w-0 flex-col gap-1.5">
        <SectionHeader label="Made by" />
        <MetaRow
          items={[
            creator === null ? (
              <span key="creator">an agent that is gone</span>
            ) : (
              <button
                key="creator"
                type="button"
                data-testid="artifact-details-creator"
                onClick={() => navigate({ to: agentPlace({ sessionId, agentId: creator.id }) })}
                className="min-w-0 truncate text-foreground underline-offset-2 hover:underline"
              >
                {creator.name}
              </button>
            ),
            <span key="kind">{ARTIFACT_KIND_MARKER_LABEL[artifact.kind]}</span>,
            <span key="scope">
              {artifact.workflowRunId === null ? 'standalone' : 'workflow run'}
            </span>,
            <span key="revision">rev {artifact.revision}</span>,
            <span key="created" className="tabular-nums">
              {formatCompactDateTime({ iso: artifact.createdAt })}
            </span>,
          ]}
        />
      </section>
      {artifact.kind === 'plan' ? (
        <ArtifactPlanRuns sessionId={sessionId} planId={artifact.id} agents={agents} />
      ) : null}
      {artifact.kind === 'report' ? (
        <ArtifactReportProvenance
          sessionId={sessionId}
          artifact={artifact}
          agents={agents}
          artifacts={artifacts}
          onSelectArtifact={openArtifact}
        />
      ) : null}
      {artifact.kind === 'wireframe' ? <ArtifactWireframeProvenance artifact={artifact} /> : null}
      <section aria-label="Scouts" className="flex min-w-0 flex-col gap-1.5">
        <SectionHeader label="Scouts" />
        <ArtifactScouts
          sessionId={sessionId}
          agentId={artifact.agentId}
          emptyLine="no scout read a repository for this one"
        />
      </section>
      <ArtifactBuiltFrom artifact={artifact} />
      <ArtifactSavedCopy savedCopy={savedCopy} />
    </div>
  );
};
