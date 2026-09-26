import type { Session, WorkflowId, WorkspaceId } from '@goodboy/types';
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

export type SessionDraftStart =
  | {
      readonly kind: 'task';
      readonly candidate: IssueCandidate;
      readonly title: string;
      readonly goal: string;
    }
  | { readonly kind: 'workflow'; readonly workflowId: WorkflowId; readonly goal: string }
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
    case 'workflow': {
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

type LaunchParams = {
  readonly get: GetFn;
  readonly session: Session;
  readonly start: SessionDraftStart;
};

const launch = async ({ get, session, start }: LaunchParams): Promise<void> => {
  switch (start.kind) {
    case 'task':
      return;
    case 'workflow':
      await get().attachWorkflowToSession(session.id, start.workflowId, {
        goal: start.goal.trim(),
        navigate: true,
      });
      return;
    case 'scout':
      await get().spawnAgent(session.id, {
        kindOverride: start.agentKind,
        initialPrompt: start.prompt,
        focus: 'agent',
        ...(start.routing !== null && {
          provider: start.routing.provider,
          model: start.routing.model,
          effort: start.routing.effort,
        }),
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
    const { session } = await get().createSession({
      workspaceId,
      goal: goal === '' ? title : goal,
      title,
      omitGoalSlot: goal === '',
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
