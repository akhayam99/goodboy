import { useEffect, useState } from 'react';
import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type IsoDateTime,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { SentToLeadPhase } from '../../../../../store/slices/send-to-lead/state';
import type { WorkLead } from '../../../../../store/slices/work/state';
import { aView } from '../../../../../features/auto/testing/autoViewFixtures';
import { failedCheckOf } from '../../../../../features/work/sendToLead/failedCheckOf';
import { NAMES } from '../../../../../shared/utils/names';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

export type SendToLeadSceneState = 'one' | 'pick' | 'none' | 'sent' | 'stopped';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly state: SendToLeadSceneState;
};

type LeadParams = {
  readonly key: string;
  readonly goal: string;
  readonly sessionId: SessionId;
  readonly projectId: string;
  readonly branches: ReadonlyArray<string>;
  readonly updatedAt: number;
};

const leadOf = ({ key, goal, sessionId, projectId, branches, updatedAt }: LeadParams): WorkLead => {
  const base = aView({ phase: 'answering' });
  const treeId = brandId<AutoTreeId>({ value: `tree-${key}` });
  return {
    treeId,
    sessionId,
    sessionGoal: goal,
    projectId,
    branches,
    projectIds: [projectId],
    view: {
      ...base,
      tree: {
        ...base.tree,
        id: treeId,
        sessionId,
        rootAgentId: brandId<AgentId>({ value: `lead-${key}` }),
        updatedAt,
      },
    },
  };
};

const OTHER_SESSION = brandId<SessionId>({ value: 'session-hbl-412' });

const RETRY_MS = 300;

type CheckMount = {
  readonly mountId: MountId;
  readonly projectId: string;
  readonly branch: string;
};

const failingMountOf = (): CheckMount | null => {
  const github = useAppStore.getState().mountGithub;
  const found = Object.values(github).find((entry) => failedCheckOf({ github: entry }) !== null);
  return found === undefined
    ? null
    : { mountId: found.mountId, projectId: found.projectId, branch: found.branch };
};

type SeedParams = {
  readonly state: SendToLeadSceneState;
  readonly mount: CheckMount;
};

const leadsOf = ({ state, mount }: SeedParams): ReadonlyArray<WorkLead> => {
  if (state === 'none') {
    return [];
  }
  const holder = leadOf({
    key: 'hbl-417',
    goal: 'HBL-417',
    sessionId: OTHER_SESSION,
    projectId: mount.projectId,
    branches: [mount.branch],
    updatedAt: 2,
  });
  if (state !== 'pick') {
    return [holder];
  }
  return [
    { ...holder, branches: ['hl/retry-cap'] },
    leadOf({
      key: 'hbl-412',
      goal: 'HBL-412',
      sessionId: COLUMN_SESSION_ID,
      projectId: mount.projectId,
      branches: ['hl/digest'],
      updatedAt: 1,
    }),
  ];
};

const PHASE: Readonly<Partial<Record<SendToLeadSceneState, SentToLeadPhase>>> = {
  sent: 'sent',
  stopped: 'stopped',
};

const markSent = ({ state, mount }: SeedParams): boolean => {
  const phase = PHASE[state];
  const card = document.querySelector<HTMLElement>('[data-move^="suggestion:fix-checks"]');
  const key = card?.dataset.move ?? null;
  if (phase === undefined || key === null) {
    return phase === undefined;
  }
  const messageId = 'message-scene-79';
  const rootAgentId = brandId<AgentId>({ value: 'lead-hbl-417' });
  const text = 'The check integration-tests failed.';
  useAppStore.setState((current) => ({
    agentQueue: {
      ...current.agentQueue,
      [rootAgentId]: [
        {
          id: messageId,
          agentId: rootAgentId,
          content: text,
          attachments: [],
          override: undefined,
          status: 'queued',
          createdAt: brandId<IsoDateTime>({ value: new Date().toISOString() }),
        },
      ],
    },
    sentToLead: {
      ...current.sentToLead,
      [key]: {
        key,
        sessionId: COLUMN_SESSION_ID,
        target: {
          treeId: brandId<AutoTreeId>({ value: 'tree-hbl-417' }),
          rootAgentId,
          sessionId: OTHER_SESSION,
          title: 'HBL-417',
        },
        isNew: false,
        messageId,
        text,
        note: '',
        threadId: null,
        mountId: mount.mountId,
        branch: mount.branch,
        phase,
        failure: null,
      },
    },
  }));
  return true;
};

const openPicker = (): boolean => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === NAMES.sendToLeadPick,
  );
  button?.click();
  return button !== undefined;
};

const quietMount = ({ mount }: Pick<SeedParams, 'mount'>): void => {
  useAppStore.setState((current) => ({
    sessionPhaseRuns: {
      ...current.sessionPhaseRuns,
      [COLUMN_SESSION_ID]: (current.sessionPhaseRuns[COLUMN_SESSION_ID] ?? []).map((agent) =>
        agent.status === 'running' && (agent.mountId === mount.mountId || agent.mountId == null)
          ? { ...agent, status: 'completed' }
          : agent,
      ),
    },
  }));
};

export const SendToLeadScene = ({ theme, state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedCentralColumn({ kind: 'branches' });
    const mount = failingMountOf();
    const workspaceId =
      sessionById(useAppStore.getState().sessions, COLUMN_SESSION_ID)?.workspaceId ?? null;
    if (mount !== null && workspaceId !== null) {
      useAppStore.setState({
        loadWorkLeads: async () => undefined,
        workWorkspaceId: workspaceId,
        workLeads: leadsOf({ state, mount }),
      });
    }
    setIsReady(true);
    if (mount === null) {
      return undefined;
    }
    let timer = 0;
    let isQuiet = false;
    const settle = () => {
      if (!isQuiet) {
        quietMount({ mount });
        isQuiet = true;
      }
      const isDone = state === 'pick' ? openPicker() : markSent({ state, mount });
      if (!isDone) {
        timer = window.setTimeout(settle, RETRY_MS);
      }
    };
    timer = window.setTimeout(settle, RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [state, theme]);
  return isReady ? <CentralColumnScene theme={theme} kind="branches" /> : null;
};
