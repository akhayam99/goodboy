import { aProject, aSession, aWorkspace, anAgent, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import type {
  Agent,
  AgentId,
  OverrideSettings,
  Project,
  ProjectId,
  Session,
  SessionId,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { STORY_NOW, storySpies } from './spies';

export const emptyOverrides: OverrideSettings = EMPTY_OVERRIDES;

type WorkspaceOverridesInput = Partial<Workspace> & { readonly id: WorkspaceId };

export const buildStoryWorkspace = (overrides: WorkspaceOverridesInput): Workspace =>
  aWorkspace({ name: 'Acme', slug: 'acme', ...overrides });

type ProjectOverridesInput = Partial<Project> & {
  readonly id: ProjectId;
  readonly workspaceId: WorkspaceId;
};

export const buildStoryProject = (overrides: ProjectOverridesInput): Project =>
  aProject({ name: 'app', rootPath: '/tmp/app', ...overrides });

type SessionOverridesInput = Partial<Session> & {
  readonly id: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const buildStorySession = (overrides: SessionOverridesInput): Session =>
  aSession({ goal: 'ship the thing', ...overrides });

type AgentOverridesInput = Partial<Agent> & {
  readonly id: AgentId;
  readonly sessionId: SessionId;
};

export const buildStoryAgent = (overrides: AgentOverridesInput): Agent => anAgent(overrides);

export const connectedAnthropicState = () => ({
  providers: [
    {
      id: 'anthropic',
      binary: 'claude',
      connection: 'connected',
      name: 'Claude',
      installation: 'installed',
    } as never,
  ],
  authResults: { anthropic: { state: 'connected', identity: 'test' } } as never,
});

export async function* emptyTurnStream(): AsyncIterable<TurnEvent> {}

export const assistantTurnStream = (text: string) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    yield {
      kind: 'assistant_text',
      runId: 'run-story' as never,
      delta: text,
      at: STORY_NOW,
    };
  };

export const recordedEventKinds = (): ReadonlyArray<string> =>
  storySpies.insertSessionEvent.mock.calls.map(([{ event }]) => event.kind);

export const recordedEvent = (
  kind: string,
): { readonly payload?: Record<string, unknown> } | undefined =>
  storySpies.insertSessionEvent.mock.calls
    .map(
      ([{ event }]) =>
        event as { readonly kind: string; readonly payload?: Record<string, unknown> },
    )
    .find((event) => event.kind === kind);
