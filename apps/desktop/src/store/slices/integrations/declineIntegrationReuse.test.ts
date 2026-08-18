import { describe, expect, it } from 'vitest';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { declineIntegrationReuse } from './declineIntegrationReuse';

const APP_WEB = 'workspace-app-web' as WorkspaceId;
const API = 'workspace-api' as WorkspaceId;

type State = {
  declinedIntegrationReuse: Record<string, ReadonlyArray<WorkspaceIntegrationProvider>>;
};

const harness = () => {
  const state: State = { declinedIntegrationReuse: {} };
  const set = (updater: (current: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  };
  return { state, decline: declineIntegrationReuse(set as never) };
};

describe('declineIntegrationReuse', () => {
  it('remembers the refusal for that workspace and provider', () => {
    const { state, decline } = harness();

    decline({ provider: 'linear', workspaceId: API });

    expect(state.declinedIntegrationReuse[API]).toEqual(['linear']);
  });

  it('leaves other workspaces free to accept the same offer', () => {
    const { state, decline } = harness();

    decline({ provider: 'linear', workspaceId: API });

    expect(state.declinedIntegrationReuse[APP_WEB]).toBeUndefined();
  });

  it('leaves other providers in the same workspace free to be offered', () => {
    const { state, decline } = harness();

    decline({ provider: 'linear', workspaceId: API });
    decline({ provider: 'jira', workspaceId: API });

    expect(state.declinedIntegrationReuse[API]).toEqual(['linear', 'jira']);
  });

  it('records a repeated refusal once', () => {
    const { state, decline } = harness();

    decline({ provider: 'linear', workspaceId: API });
    decline({ provider: 'linear', workspaceId: API });

    expect(state.declinedIntegrationReuse[API]).toEqual(['linear']);
  });
});
