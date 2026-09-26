import { useEffect, useState } from 'react';
import type { Agent, AgentId } from '@goodboy/types';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { REPORT_ARTIFACT_ID, SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const VARIANT = sceneParam({ key: 'v' }) ?? 'collection';
const OPEN = sceneParam({ key: 'open' });
const OPEN_LABELS: ReadonlyArray<string> = OPEN === null ? [] : [OPEN];

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

type ClonesParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const failedClones = ({ agents }: ClonesParams): ReadonlyArray<Agent> => {
  const report = agents.find((agent) => agent.kind === 'report') ?? null;
  const wireframe = agents.find((agent) => agent.kind === 'wireframe') ?? null;
  const clones: Array<Agent> = [];
  if (report !== null) {
    clones.push({
      ...report,
      id: 'mock-artifact-states-agent-report-failed' as AgentId,
      name: 'Northwind rollout summary',
      status: 'completed',
      lastFinishedAt: NOW,
    });
  }
  if (wireframe !== null) {
    clones.push({
      ...wireframe,
      id: 'mock-artifact-states-agent-wireframe-failed' as AgentId,
      name: 'Payout export screen',
      status: 'completed',
      lastFinishedAt: NOW,
    });
  }
  return clones;
};

export const ArtifactStatesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({
      focusedArtifactId: VARIANT === 'detail-failed' ? REPORT_ARTIFACT_ID : null,
    });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'nw/fix-posting-rounding' },
      telemetryAt: NOW,
      lens: 'plans',
    });
    const agents = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    if (VARIANT === 'empty' || VARIANT === 'create-empty') {
      useAppStore.setState({
        sessionArtifacts: { [SESSION_ID]: [] },
        sessionPhaseRuns: { [SESSION_ID]: [] },
        sessionPlans: { [SESSION_ID]: [] },
        agentTurnState: {},
      });
    }
    if (VARIANT === 'failed' || VARIANT === 'detail-failed') {
      useAppStore.setState({
        sessionPhaseRuns: { [SESSION_ID]: [...agents, ...failedClones({ agents })] },
      });
    }
    if (VARIANT === 'create-empty') {
      useAppStore.getState().openArtifactCreation({
        sessionId: SESSION_ID,
        kind: 'report',
        workflowRunId: null,
        note: null,
      });
    }
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: OPEN_LABELS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 150,
  });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ArtifactStudio sessionId={SESSION_ID} />} />;
};
