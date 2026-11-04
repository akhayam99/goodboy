import { useEffect, useState } from 'react';
import { COLLAPSED_RAIL_WIDTH, DrawerColumn } from '@goodboy/ui';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import type { AgentQueuedTurn } from '../../../../../store/slices/agentQueue/types';
import { SceneAutoTreeNav } from '../u26/SceneAutoTreeNav';
import { shellFoldsOf } from '../../../../shellArrangement/shellFoldsOf';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { seedActivityRunScene } from '../activityRunSeed';
import {
  AUTO_PLAN,
  AUTO_PLAN_ID,
  AUTO_PLAN_STORED,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  PLANNER_ID,
  autoSceneOf,
  type AutoSceneState,
} from './autoSceneSeed';

type Props = {
  readonly state: AutoSceneState;
  readonly isPlanOpen?: boolean;
  readonly selected?: 'root' | 'planner';
  readonly mountAct?: 'pending' | 'failing';
};

const TRAY_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TRAY_TURN: AgentQueuedTurn = {
  id: 'mock-tray-turn-1',
  agentId: AUTO_ROOT_ID,
  content: 'And log every retry with its idempotency key.',
  attachments: [
    {
      id: 'mock-tray-image-1',
      fileName: 'retry-log.png',
      mimeType: 'image/png',
      dataUrl: TRAY_IMAGE_DATA_URL,
      relPath: null,
    },
  ],
  override: undefined,
  status: 'queued',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-20T12:11:00.000Z' }),
};

const PLAN_OPEN_DELAY_MS = 400;
const MOUNT_CLICK_DELAY_MS = 600;
const MOUNT_FAILURE = 'The branch ak/feat-new-explore is already used by another worktree.';

export const AutoChatScene = ({
  state,
  isPlanOpen = false,
  selected = 'root',
  mountAct,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);
  const selectedId: AgentId = selected === 'root' ? AUTO_ROOT_ID : PLANNER_ID;
  const data = autoSceneOf({ state });
  const agent = data.agents.find((candidate) => candidate.id === selectedId) ?? null;
  const folds = shellFoldsOf({ paneSizing: isDrawerOpen ? sizing : null });

  useEffect(() => {
    seedActivityRunScene();
    const scene = autoSceneOf({ state });
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SESSION.id]: scene.agents },
      agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
      agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
      autoTreeViews: { [AUTO_SESSION.id]: [scene.view] },
      loadAutoTrees: async () => undefined,
      selectedAgentId: { [AUTO_SESSION.id]: selectedId },
      agentPane: { [AUTO_SESSION.id]: 'transcript' },
      agentTurnState: { [AUTO_ROOT_ID]: scene.rootTurn },
      agentQueue: { [AUTO_ROOT_ID]: state === 'bothQueues' ? [TRAY_TURN] : [] },
      transcripts: { [AUTO_ROOT_ID]: scene.events },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN] : [] },
      sessionArtifacts: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [] },
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: null,
      ...(state === 'mount-ask'
        ? {
            sessionProjectMounts: {
              ...useAppStore.getState().sessionProjectMounts,
              [AUTO_SESSION.id]: (
                useAppStore.getState().sessionProjectMounts[AUTO_SESSION.id] ?? []
              ).filter((mount) => mount.mountName !== 'notify-relay'),
            },
          }
        : {}),
      ...(mountAct === undefined
        ? {}
        : {
            ensureProjectMounted:
              mountAct === 'pending'
                ? () => new Promise<never>(() => undefined)
                : () => Promise.reject(new Error(MOUNT_FAILURE)),
          }),
    });
    setIsReady(true);
    if (mountAct !== undefined) {
      const clicker = window.setTimeout(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.find((button) => (button.textContent ?? '').startsWith('Add '))?.click();
      }, MOUNT_CLICK_DELAY_MS);
      return () => window.clearTimeout(clicker);
    }
    if (!isPlanOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.setState({
        drawer: {
          kind: 'artifact-document',
          sessionId: AUTO_SESSION.id,
          payload: { artifactId: AUTO_PLAN_ID, revision: null },
        },
      });
    }, PLAN_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, isPlanOpen, selectedId, mountAct]);

  if (!isReady || agent === null) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <main className="flex h-screen bg-background text-foreground">
        {folds.isRailNarrow ? (
          <nav
            aria-label="Sidebar"
            className="flex h-full shrink-0 flex-col border-r border-border-soft pt-1"
            style={{ width: COLLAPSED_RAIL_WIDTH }}
          />
        ) : (
          <SceneAutoTreeNav session={AUTO_SESSION} rootAgentId={AUTO_ROOT_ID} />
        )}
        <DrawerColumn
          main={
            <AgentDetailPane
              session={AUTO_SESSION}
              agent={agent}
              isChatActive
              onBack={() => undefined}
            />
          }
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </AutoReleaseContext.Provider>
  );
};
