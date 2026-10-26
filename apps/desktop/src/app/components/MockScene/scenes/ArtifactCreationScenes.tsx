import { useEffect, useState } from 'react';
import type {
  Agent,
  ProviderId,
  Session,
  SessionProjectMount,
  Workflow,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import { DrawerColumn } from '@goodboy/ui';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import { selectDrawerPlacement } from '../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../DrawerHost';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import type { GeneratedArtifactKind } from '../../../../features/artifacts/artifactCollection';
import type { ArtifactCreationDraft } from '../../../../store/slices/artifactDrafts/types';
import { useAppStore } from '../../../../store';
import { SESSION_ID, seedArtifactScene } from './artifactSeed';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const RUN_ID = 'mock-artifact-run-settlement' as WorkflowRunId;
const WORKFLOW_ID = 'mock-artifact-workflow-settlement' as WorkflowId;
const AT = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

const ANTHROPIC: ProviderDisplayInfo = {
  id: 'anthropic' as ProviderId,
  binary: 'claude',
  capabilities: { models: [] },
  connection: 'connected',
  version: '2.1.251',
  identity: 'harborline',
  label: 'Claude',
  error: null,
  docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
};

const draftFor = ({
  kind,
  brief,
}: {
  readonly kind: GeneratedArtifactKind;
  readonly brief: string;
}): ArtifactCreationDraft => {
  const base = {
    brief,
    attachments: [],
    mountIds: [],
    basedOn: { kind: 'workflow-run', workflowRunId: RUN_ID },
    routing: null,
    updatedAt: AT,
  } as const;
  return kind === 'report'
    ? { ...base, kind: 'report', reportType: 'session-summary' }
    : { ...base, kind: 'wireframe', fidelity: 'high', target: 'both' };
};

const ArtifactCreationScene = ({
  kind,
  brief,
}: {
  readonly kind: GeneratedArtifactKind;
  readonly brief: string;
}) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const placement = useAppStore(selectDrawerPlacement);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: null });
    const store = useAppStore.getState();
    const seeded = store.sessions[0];
    const mount = store.sessionProjectMounts[SESSION_ID]?.[0];
    if (seeded === undefined || mount === undefined) {
      return;
    }
    const session: Session = {
      ...seeded,
      workflowRuns: [
        {
          id: RUN_ID,
          workflowId: WORKFLOW_ID,
          ordinal: 0,
          currentStep: 0,
          autoRun: false,
          triggerMode: 'manual',
          executionMode: 'static',
          createdAt: AT,
        },
      ],
    };
    const workflow: Workflow = {
      id: WORKFLOW_ID,
      workspaceId: seeded.workspaceId,
      name: 'Settlement rounding fix',
      description: 'Trace, plan, fix and cover the rounding drift.',
      goal: 'Fix the rounding drift',
      steps: [],
      origin: 'custom',
      isPreset: false,
      createdAt: AT,
      updatedAt: AT,
    };
    const agents: ReadonlyArray<Agent> = (store.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) =>
      agent.kind === 'report' || agent.kind === 'wireframe'
        ? agent
        : { ...agent, workflowRunId: RUN_ID },
    );
    useAppStore.setState({
      sessions: [session],
      sessionPhaseRuns: { [SESSION_ID]: agents },
      sessionActiveMount: { [SESSION_ID]: (mount as SessionProjectMount).mountId },
      providers: [ANTHROPIC],
      phaseTemplates: { [seeded.workspaceId]: [workflow] },
      artifactDrafts: { [SESSION_ID]: { [kind]: draftFor({ kind, brief }) } },
      setArtifactDraft: () => undefined,
      clearArtifactDraft: () => undefined,
      hydrateArtifactDrafts: () => undefined,
      openArtifactCreation: () => undefined,
    });
    useAppStore.getState().openDrawer({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form: kind },
    });
    setIsReady(true);
  }, [kind, brief]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      const trigger = [...window.document.querySelectorAll('button')].find((button) =>
        button.textContent?.startsWith('Included context'),
      );
      if (trigger === undefined || trigger.getAttribute('aria-expanded') === 'true') {
        return;
      }
      trigger.click();
      window.clearInterval(interval);
    }, 150);
    return () => window.clearInterval(interval);
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <DrawerColumn
        main={
          <div className="min-h-0 flex-1">
            <ArtifactStudio sessionId={SESSION_ID} />
          </div>
        }
        drawer={<DrawerHost />}
        sizing={sizing}
        placement={placement}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const ArtifactCreateReportScene = () => (
  <ArtifactCreationScene
    kind="report"
    brief="Explain the rounding drift for the Northwind settlement team, and be explicit that the backfill has not run against settled data."
  />
);

export const ArtifactCreateWireframeScene = () => (
  <ArtifactCreationScene
    kind="wireframe"
    brief="Draw the flow an operator walks to review a settlement batch, accept a rounding exception and land in the audit trail."
  />
);
