import { describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  checkoutFastForward: vi.fn(async () => ({
    branch: 'main',
    upstream: 'origin/main',
    commitsPulled: 1,
  })),
}));

vi.mock('../../../shared/lib/repo', () => ({ checkoutFastForward: h.checkoutFastForward }));

import { fastForwardProjectCheckout } from './fastForwardProjectCheckout';

describe('fastForwardProjectCheckout', () => {
  it('fetches with the credentials of the project and its workspace', async () => {
    const loadProjectGitStatus = vi.fn(async () => undefined);
    const state = {
      projects: [
        {
          id: 'proj-ledger',
          workspaceId: 'ws-harborline',
          rootPath: '/repos/ledger-core',
          kind: 'repo',
        },
      ],
      projectCheckoutPulling: {},
      loadProjectGitStatus,
    };
    const get: GetFn = () => state as unknown as AppStore;
    const set: SetFn = vi.fn();

    await fastForwardProjectCheckout(set, get)({ projectId: 'proj-ledger' as ProjectId });

    expect(h.checkoutFastForward).toHaveBeenCalledWith({
      checkoutPath: '/repos/ledger-core',
      workspaceId: 'ws-harborline',
      projectId: 'proj-ledger',
    });
    expect(loadProjectGitStatus).toHaveBeenCalledWith({ projectId: 'proj-ledger' });
  });
});
