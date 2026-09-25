import { useMemo } from 'react';
import { DrawerFrame, SegmentedTabs } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';
import type { ArtifactDrawerTab } from '../../../../store/slices/drawer/state';
import { planAsArtifact } from '../../../plans/planAsArtifact';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ARTIFACT_KIND_CONCEPT } from '../../artifactPresentation';
import { ArtifactConversation } from '../ArtifactStudio/ArtifactConversation';
import { ArtifactShellDetails } from './ArtifactShellDetails';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly tab: ArtifactDrawerTab;
  readonly onClose: () => void;
};

const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'chat', label: 'Chat' },
] satisfies ReadonlyArray<{ readonly value: ArtifactDrawerTab; readonly label: string }>;

export const ArtifactShellDrawer = ({ sessionId, artifactId, tab, onClose }: Props) => {
  const artifacts = useAppStore(
    (s) => s.sessionArtifacts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionArtifact>),
  );
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const plans = useSessionPlans(sessionId);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const artifact = useMemo((): SessionArtifact | null => {
    const stored = artifacts.find((candidate) => candidate.id === artifactId) ?? null;
    const plan = plans.find((candidate) => candidate.id === artifactId) ?? null;
    return plan === null ? stored : planAsArtifact({ plan, stored });
  }, [artifacts, plans, artifactId]);

  if (artifact === null) {
    return null;
  }

  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;

  return (
    <DrawerFrame
      title={artifact.title}
      icon={CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT[artifact.kind]]}
      iconClassName="text-muted-foreground"
      closeLabel="Close the artifact panel"
      onClose={onClose}
      scroll={tab === 'chat' ? 'self' : 'frame'}
      action={
        <SegmentedTabs
          ariaLabel="Artifact panel"
          size="sm"
          options={TABS}
          value={tab}
          onChange={(next) =>
            openDrawer({ kind: 'artifact', sessionId, payload: { artifactId, tab: next } })
          }
        />
      }
    >
      {tab === 'chat' ? (
        <ArtifactConversation
          sessionId={sessionId}
          artifact={artifact}
          agent={creator}
          isWorkflowOwned={creator?.stepId != null}
        />
      ) : (
        <ArtifactShellDetails
          sessionId={sessionId}
          artifact={artifact}
          agents={agents}
          artifacts={artifacts}
        />
      )}
    </DrawerFrame>
  );
};
