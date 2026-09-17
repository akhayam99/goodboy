import { useState } from 'react';
import { Divider, Markdown, PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { ArtifactBuiltFrom } from './ArtifactBuiltFrom';
import { ArtifactConversation } from './ArtifactConversation';
import { ArtifactDetailsPanel } from './ArtifactDetailsPanel';
import { ArtifactIdentityBand, type ArtifactDetailTab } from './ArtifactIdentityBand';
import { ReportStudio } from '../../../reports/components/ReportStudio';
import {
  ReportBandActions,
  type ReportMode,
} from '../../../reports/components/ReportStudio/ReportBandActions';
import { useReportRegenerate } from '../../../reports/useReportRegenerate';
import { WireframeStudio } from '../../../wireframes/components/WireframeStudio';
import { WireframeDivergenceChip } from '../../../wireframes/components/WireframeDivergenceChip';
import { WireframeVariantAction } from '../../../wireframes/components/WireframeVariantAction';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly onBack: () => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
};

type PerArtifact<T> = Readonly<{ artifactId: ArtifactId; value: T }>;

export const ArtifactDetail = ({
  sessionId,
  artifact,
  agents,
  artifacts,
  onBack,
  onSelectArtifact,
}: Props) => {
  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const isWorkflowOwned = creator?.stepId != null;
  const [opened, setOpened] = useState<PerArtifact<ArtifactDetailTab>>({
    artifactId: artifact.id,
    value: 'artifact',
  });
  const [details, setDetails] = useState<PerArtifact<boolean>>({
    artifactId: artifact.id,
    value: false,
  });
  const [reportMode, setReportMode] = useState<PerArtifact<ReportMode>>({
    artifactId: artifact.id,
    value: 'preview',
  });
  const regenerate = useReportRegenerate({ sessionId, artifact });

  const tab: ArtifactDetailTab = opened.artifactId === artifact.id ? opened.value : 'artifact';
  const isDetailsOpen = details.artifactId === artifact.id ? details.value : false;
  const mode: ReportMode = reportMode.artifactId === artifact.id ? reportMode.value : 'preview';

  const tabs = [
    { value: 'artifact', label: 'Artifact' },
    { value: 'conversation', label: isWorkflowOwned ? 'Step transcript' : 'Conversation' },
  ] satisfies ReadonlyArray<{ readonly value: ArtifactDetailTab; readonly label: string }>;

  return (
    <div
      data-testid="artifact-detail"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <ArtifactIdentityBand
        artifact={artifact}
        tabs={tabs}
        tab={tab}
        isDetailsOpen={isDetailsOpen}
        stateChip={
          artifact.kind === 'wireframe' ? (
            <WireframeDivergenceChip artifact={artifact} creatorName={creator?.name ?? null} />
          ) : null
        }
        actions={
          <>
            {artifact.kind === 'report' ? (
              <ReportBandActions
                mode={mode}
                regenerate={regenerate}
                onModeChange={(next) => setReportMode({ artifactId: artifact.id, value: next })}
              />
            ) : null}
            {artifact.kind === 'wireframe' ? (
              <WireframeVariantAction sessionId={sessionId} artifact={artifact} />
            ) : null}
          </>
        }
        onTabChange={(next) => setOpened({ artifactId: artifact.id, value: next })}
        onDetailsToggle={() => setDetails({ artifactId: artifact.id, value: !isDetailsOpen })}
        onBack={onBack}
      />
      {isDetailsOpen ? (
        <ArtifactDetailsPanel
          sessionId={sessionId}
          artifact={artifact}
          creatorName={creator?.name ?? 'unknown agent'}
          agents={agents}
          artifacts={artifacts}
          onSelectArtifact={onSelectArtifact}
        />
      ) : null}
      {regenerate.error === null ? null : (
        <span role="alert" className={cn('shrink-0 pb-2 text-2xs text-danger', PANE_RHYTHM.inset)}>
          {regenerate.error}
        </span>
      )}
      <Divider />
      {tab === 'conversation' ? (
        <ArtifactConversation
          sessionId={sessionId}
          artifact={artifact}
          agent={creator}
          isWorkflowOwned={isWorkflowOwned}
        />
      ) : (
        <ScrollFade
          className="min-h-0 flex-1"
          viewportClassName={PANE_RHYTHM.detail.body}
          fadeSize={24}
        >
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
            {artifact.kind === 'report' ? (
              <ReportStudio sessionId={sessionId} artifact={artifact} mode={mode} />
            ) : null}
            {artifact.kind === 'wireframe' ? (
              <WireframeStudio sessionId={sessionId} artifact={artifact} />
            ) : null}
            {artifact.kind === 'plan' ? (
              <Markdown text={artifact.sourceText} className="text-xs" />
            ) : null}
            <ArtifactBuiltFrom artifact={artifact} />
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
