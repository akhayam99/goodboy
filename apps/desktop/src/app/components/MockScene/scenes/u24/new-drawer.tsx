import { useEffect, useState } from 'react';
import { DrawerColumn, ScrollFade } from '@goodboy/ui';
import type { OverrideSettings, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import { WritePanel } from '../../../../../features/artifacts/components/WritePanel';
import { NewDrawerBody } from '../../../../../features/session/components/NewDrawer/NewDrawerBody';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { draftFromWorkflow } from '../../../../../features/workflows/engine';
import { writeLastWorkflowMode } from '../../../../../features/workflows/components/WorkflowBuilderView/lastWorkflowMode';
import { writeLastNewTab } from '../../../../../features/session/newDrawerTab';
import type { NewDrawerTab } from '../../../../../store/slices/drawer/state';
import { sceneClock } from '../../sceneClock';
import { useSceneClicks } from '../audit/useSceneClicks';
import { RULES_PROVIDERS } from '../audit/workflowRulesSeed';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

const NO_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultBranchTemplate: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  workflowRules: null,
};

const clock = sceneClock({ anchor: '2026-10-14T09:00:00.000Z' });

const GOAL =
  'Stop retried webhooks posting a second credit, and let support see when a delivery retried';

const GUIDANCE = [
  'Never change the ledger-core schema without asking first.',
  'Keep every commit scoped to one project.',
  'Open the pull request as a draft.',
].join('\n');

const PRESET_ID = brandedId<WorkflowId>({ value: 'mock-new-drawer-preset-ship' });

const PRESET: Workflow = {
  id: PRESET_ID,
  workspaceId: SESSION.workspaceId,
  name: 'Scout, plan, build',
  description: 'Read the code, plan the change, then build it.',
  steps: [
    {
      id: brandedId<StepId>({ value: 'mock-new-drawer-step-scout' }),
      workflowId: PRESET_ID,
      ordinal: 0,
      name: 'Scout the retry path',
      role: 'scout',
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    },
    {
      id: brandedId<StepId>({ value: 'mock-new-drawer-step-planner' }),
      workflowId: PRESET_ID,
      ordinal: 1,
      name: 'Plan the guard',
      role: 'planner',
      effort: 'high',
      promptPrefix: '',
      verbosity: 'normal',
    },
    {
      id: brandedId<StepId>({ value: 'mock-new-drawer-step-implementer' }),
      workflowId: PRESET_ID,
      ordinal: 2,
      name: 'Build the guard',
      role: 'implementer',
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
};

type SceneState = {
  readonly tab: NewDrawerTab;
  readonly writeKind?: 'report' | 'wireframe';
  readonly isAuto?: boolean;
  readonly isPreset?: boolean;
  readonly hasGuidance?: boolean;
  readonly autoGoal?: string;
  readonly clicks?: ReadonlyArray<string>;
  readonly width: number;
};

type Props = {
  readonly state: SceneState;
};

const NewDrawerScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    const store = useAppStore.getState();
    const workspaceId = SESSION.workspaceId;
    useAppStore.setState({
      providers: RULES_PROVIDERS,
      refreshProviders: async () => undefined,
      phaseTemplates: { [workspaceId]: [PRESET] },
      workspaceOverrides: {
        [workspaceId]: {
          ...NO_OVERRIDES,
          workflowRules: {
            ...DEFAULT_WORKFLOW_RULES,
            autonomy: 'plan',
            standingGuidance: state.hasGuidance === true ? GUIDANCE : '',
          },
        },
      },
    });
    writeLastNewTab({ workspaceId, tab: state.tab });
    writeLastWorkflowMode({ workspaceId, mode: state.isPreset === true ? 'preset' : 'dynamic' });
    if (state.tab === 'run') {
      store.setWorkflowDraft(SESSION_ID, {
        mode: state.isPreset === true ? 'preset' : 'dynamic',
        goalText: GOAL,
        goalHistory: [],
        selectedPresetId: state.isPreset === true ? PRESET_ID : null,
        basePresetId: state.isPreset === true ? PRESET_ID : null,
        steps: state.isPreset === true ? draftFromWorkflow({ workflow: PRESET }).steps : [],
        autoRun: true,
        autonomy: 'plan',
        title: '',
        orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
        providerPool: null,
        ...(state.hasGuidance === true && { guidance: GUIDANCE }),
      });
    }
    if (state.autoGoal !== undefined) {
      store.setNewDrawerAutoGoal({ sessionId: SESSION_ID, goal: state.autoGoal });
    }
    setIsReady(true);
  }, [state]);

  useSceneClicks({
    isReady,
    labels: state.clicks ?? [],
    selector: 'button, [role="tab"], [role="radio"]',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground" style={{ width: state.width }}>
      <DrawerColumn
        main={
          <ScrollFade className="min-h-0 flex-1">
            <div className="px-6 py-4">
              <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
            </div>
          </ScrollFade>
        }
        drawer={
          <NewDrawerBody
            session={SESSION}
            payload={{
              tab: state.tab,
              ...(state.writeKind !== undefined && { writeKind: state.writeKind }),
            }}
            isAuto={state.isAuto === true}
            writePanel={WritePanel}
            onClose={() => undefined}
          />
        }
        sizing="reader"
        placement="overlay"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const U24_NEW_DRAWER_SCENES = {
  'new-drawer-run': () => <NewDrawerScene state={{ tab: 'run', width: 1440 }} />,
  'new-drawer-run-guidance': () => (
    <NewDrawerScene state={{ tab: 'run', hasGuidance: true, width: 1440 }} />
  ),
  'new-drawer-run-preset': () => (
    <NewDrawerScene state={{ tab: 'run', isPreset: true, width: 1440 }} />
  ),
  'new-drawer-run-preset-pin': () => (
    <NewDrawerScene
      state={{
        tab: 'run',
        isPreset: true,
        clicks: ['Model for Plan the guard', 'Pin a model'],
        width: 1440,
      }}
    />
  ),
  'new-drawer-agent': () => <NewDrawerScene state={{ tab: 'agent', width: 1440 }} />,
  'new-drawer-agent-auto': () => (
    <NewDrawerScene
      state={{
        tab: 'agent',
        isAuto: true,
        autoGoal: 'Find why webhooks retry and tell me where to fix it',
        width: 1440,
      }}
    />
  ),
  'new-drawer-write': () => (
    <NewDrawerScene state={{ tab: 'write', writeKind: 'report', width: 1440 }} />
  ),
  'new-drawer-write-wireframe': () => (
    <NewDrawerScene state={{ tab: 'write', writeKind: 'wireframe', width: 1440 }} />
  ),
  'new-drawer-narrow': () => <NewDrawerScene state={{ tab: 'run', width: 1100 }} />,
};
