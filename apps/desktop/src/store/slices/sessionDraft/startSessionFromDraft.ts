import type { ProjectId, Session, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import {
  AGENT_KIND_META,
  type AgentKind,
  type AgentKindRouting,
} from '../../../features/session/agent-kind';
import { discardUncreatedSession } from '../sessions/discardUncreatedSession';
import { draftGoalText } from './draftGoalText';
import type { GetFn, SetFn } from './types';

export const SCOUT_DRAFT_TITLE = 'Scout the project';

export type SessionDraftRun = (session: Session) => Promise<void>;

export type SessionDraftMount = {
  readonly projectId: ProjectId | null;
  readonly reason: string;
};

export type SessionDraftThen =
  | { readonly kind: 'workflow-run'; readonly run: SessionDraftRun }
  | {
      readonly kind: 'agent';
      readonly agentKind: AgentKind;
      readonly prompt: string;
      readonly routing: AgentKindRouting | null;
    };

export type SessionDraftStart =
  | {
      readonly kind: 'task';
      readonly candidate: IssueCandidate;
      readonly title: string;
      readonly goal: string;
      readonly then?: SessionDraftThen;
      readonly mount?: SessionDraftMount;
    }
  | {
      readonly kind: 'workflow-run';
      readonly goal: string;
      readonly run: SessionDraftRun;
    }
  | {
      readonly kind: 'scout';
      readonly agentKind: AgentKind;
      readonly focus: string;
      readonly prompt: string;
      readonly routing: AgentKindRouting | null;
    };

export type StartSessionFromDraftParams = {
  readonly workspaceId: WorkspaceId;
  readonly start: SessionDraftStart;
};

type Seed = {
  readonly title: string;
  readonly goal: string;
};

type SeedParams = {
  readonly start: SessionDraftStart;
};

const seedOf = ({ start }: SeedParams): Seed => {
  switch (start.kind) {
    case 'task':
      return { title: start.title.trim(), goal: start.goal.trim() };
    case 'workflow-run': {
      const goal = start.goal.trim();
      return { title: draftGoalText({ text: goal }), goal };
    }
    case 'scout': {
      const goal = draftGoalText({ text: start.focus });
      const fallbackTitle =
        start.agentKind === 'scout'
          ? SCOUT_DRAFT_TITLE
          : `${AGENT_KIND_META[start.agentKind].label} the project`;
      return { title: goal === '' ? fallbackTitle : goal, goal };
    }
    default: {
      const unreachable: never = start;
      return unreachable;
    }
  }
};

type SpawnStartAgentParams = {
  readonly get: GetFn;
  readonly session: Session;
  readonly agentKind: AgentKind;
  readonly prompt: string;
  readonly routing: AgentKindRouting | null;
};

const spawnStartAgent = async ({
  get,
  session,
  agentKind,
  prompt,
  routing,
}: SpawnStartAgentParams) => {
  await get().spawnAgent(session.id, {
    kindOverride: agentKind,
    initialPrompt: prompt,
    focus: 'agent',
    ...(routing !== null && {
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
    }),
  });
};

type LaunchParams = {
  readonly get: GetFn;
  readonly session: Session;
  readonly start: SessionDraftStart;
};

const launch = async ({ get, session, start }: LaunchParams): Promise<void> => {
  switch (start.kind) {
    case 'task':
      if (start.then?.kind === 'workflow-run') {
        await start.then.run(session);
        return;
      }
      if (start.then?.kind === 'agent') {
        await spawnStartAgent({
          get,
          session,
          agentKind: start.then.agentKind,
          prompt: start.then.prompt,
          routing: start.then.routing,
        });
        return;
      }
      return;
    case 'workflow-run':
      await start.run(session);
      return;
    case 'scout':
      await spawnStartAgent({
        get,
        session,
        agentKind: start.agentKind,
        prompt: start.prompt,
        routing: start.routing,
      });
      return;
    default: {
      const unreachable: never = start;
      return unreachable;
    }
  }
};

export const startSessionFromDraft = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, start }: StartSessionFromDraftParams): Promise<Session> => {
    const { title, goal } = seedOf({ start });
    const candidate = start.kind === 'task' ? start.candidate : null;
    const mount = start.kind === 'task' ? (start.mount ?? null) : null;
    const projectId =
      mount === null ? (get().sessionDrafts[workspaceId]?.projectId ?? null) : mount.projectId;
    const { session } = await get().createSession({
      workspaceId,
      goal: goal === '' ? title : goal,
      title,
      omitGoalSlot: goal === '',
      ...(projectId !== null && { projectId }),
      ...(projectId !== null && mount !== null && { projectReason: mount.reason }),
      ...(candidate !== null && {
        externalTasks: [
          {
            provider: candidate.provider,
            externalId: candidate.externalId,
            identifier: candidate.identifier,
            url: candidate.url,
            title: candidate.title,
          },
        ],
      }),
    });
    set({ openSessionDraftWorkspaceId: null });
    try {
      await launch({ get, session, start });
    } catch (error) {
      await discardUncreatedSession({ set, sessionId: session.id });
      set({ openSessionDraftWorkspaceId: workspaceId });
      throw error;
    }
    get().discardSessionDraft({ workspaceId });
    set({ goodboyNamedSessionId: session.id });
    return session;
  };
};
