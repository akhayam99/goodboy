import { brandId, type ProviderRunId, type TurnEvent, type WorkflowId } from '@goodboy/types';
import { agentPlace } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import {
  AUTO_ROOT_ID,
  AUTO_SESSION,
  IMPLEMENTER_ID,
  autoSceneOf,
} from '../../scenes/u24/autoSceneSeed';
import type { DemoCue, DemoTimeline, DirectorStore, TimelineParams } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { appendTurnEvents } from './appendTurnEvents';
import { applyAutoScene } from './applyAutoScene';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAgent } from './patchAgent';
import { scheduleCues } from './scheduleCues';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';
import { demoRuns } from './demoRunRegistry';
import { registerTreeStopPort } from '../../../../../features/auto/treeStopPort';
import { registerTreeRetryPort } from '../../../../../features/auto/treeRetryPort';

const APPROVAL_PREFIX = 'Approved plan v';
const PLAN_AT_MS = 1400;
const IMPLEMENTER_NOTE =
  'Reading postCredit and applyCredit first. Then the key moves out of the retry loop and applyCredit learns to refuse a repeated key.';

const repliesOf = (): ReadonlyArray<string> =>
  autoSceneOf({ state: 'done' }).events.flatMap((event) =>
    event.kind === 'assistant_text' ? [event.delta] : [],
  );

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-auto-${label}-${crypto.randomUUID()}` });

type FlowParams = {
  readonly store: DirectorStore;
};

type AtParams = {
  readonly atMs: number;
};

const finishRootCue = ({ atMs }: AtParams): DemoCue => ({
  atMs,
  apply: ({ store, at }) => {
    finishAgentTurn({
      store,
      sessionId: AUTO_SESSION.id,
      agentId: AUTO_ROOT_ID,
      at,
      isViewed: true,
    });
  },
});

type UserParams = {
  readonly store: DirectorStore;
  readonly runId: ProviderRunId;
  readonly text: string;
};

const appendUserTurn = ({ store, runId, text }: UserParams): void => {
  const at = nowIso({});
  const event: TurnEvent = { kind: 'user_text', runId, text, at };
  appendTurnEvents({ store, agentId: AUTO_ROOT_ID, events: [event] });
  startAgentTurn({ store, sessionId: AUTO_SESSION.id, agentId: AUTO_ROOT_ID, runId, at });
};

type CuesParams = {
  readonly runId: ProviderRunId;
};

const planCues = ({ runId }: CuesParams): ReadonlyArray<DemoCue> => {
  const [first = '', second = ''] = repliesOf();
  const planRun = runOf({ label: 'plan' });
  const secondAt = textCuesEndMs({ atMs: PLAN_AT_MS, text: first }) + 1600;
  const planAt = textCuesEndMs({ atMs: secondAt, text: second }) + 400;
  return [
    ...textCues({ atMs: PLAN_AT_MS, agentId: AUTO_ROOT_ID, runId, text: first }),
    {
      atMs: secondAt - 1200,
      apply: ({ store, at }) => {
        applyAutoScene({ store, state: 'delegating', at, implementerRunId: runId });
        startAgentTurn({
          store,
          sessionId: AUTO_SESSION.id,
          agentId: AUTO_ROOT_ID,
          runId: planRun,
          at,
        });
      },
    },
    ...textCues({
      atMs: secondAt,
      agentId: AUTO_ROOT_ID,
      runId: planRun,
      text: second,
      isParagraph: true,
    }),
    {
      atMs: planAt,
      apply: ({ store, at }) => {
        applyAutoScene({ store, state: 'plan', at, implementerRunId: runId });
      },
    },
    finishRootCue({ atMs: planAt }),
  ];
};

type WorkParams = {
  readonly runId: ProviderRunId;
  readonly isApproval: boolean;
};

const workCues = ({ runId, isApproval }: WorkParams): ReadonlyArray<DemoCue> => {
  const replies = repliesOf();
  const third = replies[2] ?? '';
  const final = replies[3] ?? '';
  const implementerRun = runOf({ label: 'implementer' });
  const finalRun = runOf({ label: 'final' });
  const noteAt = isApproval ? textCuesEndMs({ atMs: 1000, text: third }) + 600 : 1200;
  const doneAt = textCuesEndMs({ atMs: noteAt, text: IMPLEMENTER_NOTE }) + 2200;
  const start: ReadonlyArray<DemoCue> = isApproval
    ? [
        {
          atMs: 0,
          apply: ({ store, at }) => {
            applyAutoScene({ store, state: 'working', at, implementerRunId: implementerRun });
            startAgentTurn({ store, sessionId: AUTO_SESSION.id, agentId: AUTO_ROOT_ID, runId, at });
          },
        },
        ...textCues({ atMs: 1000, agentId: AUTO_ROOT_ID, runId, text: third }),
      ]
    : [];
  return [
    ...start,
    ...textCues({
      atMs: noteAt,
      agentId: IMPLEMENTER_ID,
      runId: implementerRun,
      text: IMPLEMENTER_NOTE,
    }),
    {
      atMs: doneAt,
      apply: ({ store, at }) => {
        applyAutoScene({ store, state: 'done', at, implementerRunId: implementerRun });
        startAgentTurn({
          store,
          sessionId: AUTO_SESSION.id,
          agentId: AUTO_ROOT_ID,
          runId: finalRun,
          at,
        });
      },
    },
    ...textCues({
      atMs: doneAt + 400,
      agentId: AUTO_ROOT_ID,
      runId: finalRun,
      text: final,
      isParagraph: true,
    }),
    finishRootCue({ atMs: textCuesEndMs({ atMs: doneAt + 400, text: final }) + 600 }),
  ];
};

const installAutoActions = ({ store }: FlowParams): void => {
  installDemoWorld({ store });
  const simulatedSend = store.getState().sendTurn;
  const simulatedSpawn = store.getState().spawnAgent;
  const spawnAgent: AppStore['spawnAgent'] = async (sessionId, options) => {
    if (sessionId !== AUTO_SESSION.id) {
      return simulatedSpawn(sessionId, options);
    }
    const runId = runOf({ label: 'start' });
    const at = nowIso({});
    applyAutoScene({ store, state: 'answering', at, implementerRunId: runId });
    store.setState((current) => ({
      transcripts: { ...current.transcripts, [AUTO_ROOT_ID]: [] },
    }));
    appendUserTurn({ store, runId, text: options?.initialPrompt ?? '' });
    store.getState().navigate({
      to: agentPlace({ sessionId, agentId: AUTO_ROOT_ID }),
      drawer: { kind: 'spawned', sessionId, payload: null },
    });
    scheduleCues({
      store,
      cues: planCues({ runId }),
      now: () => nowIso({}),
      agentId: AUTO_ROOT_ID,
    });
    return AUTO_ROOT_ID;
  };
  const sendTurn: AppStore['sendTurn'] = async (input) => {
    const isApproval = input.agentId === AUTO_ROOT_ID && input.content.startsWith(APPROVAL_PREFIX);
    if (!isApproval) {
      return simulatedSend(input);
    }
    const runId = runOf({ label: 'approved' });
    appendUserTurn({ store, runId, text: input.content });
    input.onStarted?.();
    scheduleCues({
      store,
      cues: workCues({ runId, isApproval: true }),
      now: () => nowIso({}),
      agentId: AUTO_ROOT_ID,
    });
    return { blockedOverBudget: false };
  };
  const attachWorkflowToSession: AppStore['attachWorkflowToSession'] = async (
    sessionId,
    _workflowId,
    options,
  ) => {
    await spawnAgent(sessionId, { initialPrompt: options?.goal ?? '' });
  };
  registerTreeStopPort({
    port: async () => {
      demoRuns.stop({ agentId: AUTO_ROOT_ID });
      const at = nowIso({});
      store.setState((current) => ({
        autoTreeViews: {
          ...current.autoTreeViews,
          [AUTO_SESSION.id]: (current.autoTreeViews[AUTO_SESSION.id] ?? []).map((view) => ({
            ...view,
            tree: { ...view.tree, phase: 'stopped' },
            delegations: view.delegations.map((delegation) =>
              delegation.state === 'running' || delegation.state === 'starting'
                ? { ...delegation, state: 'settled', outcome: 'stopped', settledAt: Date.now() }
                : delegation,
            ),
          })),
        },
      }));
      for (const agentId of [AUTO_ROOT_ID, IMPLEMENTER_ID]) {
        if (store.getState().agentTurnState[agentId]?.kind !== 'running') {
          continue;
        }
        finishAgentTurn({ store, sessionId: AUTO_SESSION.id, agentId, at, isViewed: true });
        patchAgent({
          store,
          sessionId: AUTO_SESSION.id,
          agentId,
          patch: { status: 'stopped', stoppedBy: 'you', stoppedAt: at },
        });
      }
      return 'stopped';
    },
  });
  registerTreeRetryPort({
    port: async () => {
      const runId = runOf({ label: 'retry' });
      scheduleCues({
        store,
        cues: workCues({ runId, isApproval: true }),
        now: () => nowIso({}),
        agentId: AUTO_ROOT_ID,
      });
      return { kind: 'retried' };
    },
  });
  store.setState({
    spawnAgent,
    sendTurn,
    attachWorkflowToSession,
    savePhaseTemplate: async (template) => {
      const at = nowIso({});
      return {
        id: template.id ?? brandId<WorkflowId>({ value: `demo-workflow-${crypto.randomUUID()}` }),
        workspaceId: template.workspaceId,
        name: template.name,
        description: template.description,
        steps: [],
        isPreset: false,
        createdAt: at,
        updatedAt: at,
      };
    },
    generateWorkflowTitle: async () => undefined,
  });
};

const WORKING_RUN = brandId<ProviderRunId>({ value: 'demo-auto-working' });

export const autoTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  if (state.autoTreeViews[AUTO_SESSION.id] === undefined) {
    return null;
  }
  const hasTree = (state.autoTreeViews[AUTO_SESSION.id] ?? []).length > 0;
  const isWorking = hasTree && state.agentTurnState[IMPLEMENTER_ID]?.kind === 'running';
  return {
    setup: installAutoActions,
    prepare: () => undefined,
    cues: isWorking ? workCues({ runId: WORKING_RUN, isApproval: false }) : [],
  };
};
