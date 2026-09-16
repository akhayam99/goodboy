import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Divider, Markdown, PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { ArtifactBuiltFrom } from './ArtifactBuiltFrom';
import { ArtifactConversation } from './ArtifactConversation';
import { ArtifactIdentityBand, type ArtifactDetailTab } from './ArtifactIdentityBand';
import { ReportStudio } from '../../../reports/components/ReportStudio';
import { WireframeStudio } from '../../../wireframes/components/WireframeStudio';
import { FocusedPane } from '../../../../shared/components/PaneShell/FocusedPane';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly count: number;
  readonly onBack: () => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
};

export const ArtifactDetail = ({
  sessionId,
  artifact,
  agents,
  artifacts,
  count,
  onBack,
  onSelectArtifact,
}: Props) => {
  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const isWorkflowOwned = creator?.stepId != null;
  const [opened, setOpened] = useState<{
    readonly artifactId: ArtifactId;
    readonly tab: ArtifactDetailTab;
  }>({
    artifactId: artifact.id,
    tab: 'artifact',
  });
  const tab: ArtifactDetailTab = opened.artifactId === artifact.id ? opened.tab : 'artifact';
  const setTab = (next: ArtifactDetailTab) => setOpened({ artifactId: artifact.id, tab: next });

  const tabs = [
    { value: 'artifact', label: 'Artifact' },
    { value: 'conversation', label: isWorkflowOwned ? 'Step transcript' : 'Conversation' },
  ] satisfies ReadonlyArray<{ readonly value: ArtifactDetailTab; readonly label: string }>;

  return (
    <FocusedPane
      lens="Artifacts"
      count={count}
      actions={
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.row} aria-hidden />
          All artifacts
        </Button>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={cn('flex shrink-0 flex-col', PANE_RHYTHM.dock)}>
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
            <ArtifactIdentityBand
              artifact={artifact}
              creatorName={creator?.name ?? 'unknown agent'}
              tabs={tabs}
              tab={tab}
              onTabChange={setTab}
            />
          </div>
        </div>
        <Divider />
        {tab === 'conversation' ? (
          <ArtifactConversation
            sessionId={sessionId}
            artifact={artifact}
            agent={creator}
            isWorkflowOwned={isWorkflowOwned}
          />
        ) : (
          <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
            <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
              {artifact.kind === 'report' ? (
                <ReportStudio
                  sessionId={sessionId}
                  artifact={artifact}
                  agents={agents}
                  artifacts={artifacts}
                  onSelectArtifact={onSelectArtifact}
                />
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
    </FocusedPane>
  );
};
