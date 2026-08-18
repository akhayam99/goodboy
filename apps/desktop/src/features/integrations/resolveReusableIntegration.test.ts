import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { resolveReusableIntegration } from './resolveReusableIntegration';

const APP_WEB = 'workspace-app-web' as WorkspaceId;
const API = 'workspace-api' as WorkspaceId;
const INFRA = 'workspace-infra' as WorkspaceId;

type LinearParams = {
  readonly workspaceId: WorkspaceId;
  readonly updatedAt: string;
};

const linearIn = ({ workspaceId, updatedAt }: LinearParams): WorkspaceIntegration => ({
  id: `integration-${workspaceId}` as WorkspaceIntegrationId,
  workspaceId,
  provider: 'linear',
  config: { workspaceUrlKey: 'serenis', viewerUserId: 'user-1', viewerName: 'Amin Khayam' },
  credentialKey: `goodboy.workspace.${workspaceId}.linear`,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: updatedAt as IsoDateTime,
});

describe('resolveReusableIntegration', () => {
  it('offers the configuration another workspace already holds', () => {
    const reusable = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: '2026-02-01T00:00:00.000Z' })],
      },
    });

    expect(reusable?.workspaceId).toBe(APP_WEB);
  });

  it('offers nothing when no other workspace has that provider', () => {
    const reusable = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {},
    });

    expect(reusable).toBeNull();
  });

  it('offers nothing when this workspace is already configured', () => {
    const reusable = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {
        [API]: [linearIn({ workspaceId: API, updatedAt: '2026-01-05T00:00:00.000Z' })],
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: '2026-02-01T00:00:00.000Z' })],
      },
    });

    expect(reusable).toBeNull();
  });

  it('offers nothing for a provider nobody has configured', () => {
    const reusable = resolveReusableIntegration({
      provider: 'jira',
      workspaceId: API,
      workspaceIntegrations: {
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: '2026-02-01T00:00:00.000Z' })],
      },
    });

    expect(reusable).toBeNull();
  });

  it('offers the most recently updated configuration when several exist', () => {
    const reusable = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: '2026-02-01T00:00:00.000Z' })],
        [INFRA]: [linearIn({ workspaceId: INFRA, updatedAt: '2026-03-01T00:00:00.000Z' })],
      },
    });

    expect(reusable?.workspaceId).toBe(INFRA);
  });

  it('breaks a tie on workspace id so the offer does not flip between renders', () => {
    const sameMoment = '2026-02-01T00:00:00.000Z';
    const first = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {
        [INFRA]: [linearIn({ workspaceId: INFRA, updatedAt: sameMoment })],
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: sameMoment })],
      },
    });
    const second = resolveReusableIntegration({
      provider: 'linear',
      workspaceId: API,
      workspaceIntegrations: {
        [APP_WEB]: [linearIn({ workspaceId: APP_WEB, updatedAt: sameMoment })],
        [INFRA]: [linearIn({ workspaceId: INFRA, updatedAt: sameMoment })],
      },
    });

    expect(first?.workspaceId).toBe(APP_WEB);
    expect(second?.workspaceId).toBe(APP_WEB);
  });
});
