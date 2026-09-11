import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

type StoreInput = Parameters<AppStore['materializeProject']>[0];

describe('materializeProject store contract', () => {
  it('accepts the planned mount id and slug the mount preflight passes', () => {
    const input = {
      sessionId: 'session-1' as SessionId,
      projectId: 'project-1' as ProjectId,
      reason: 'added manually by the user',
      mountId: 'mount-1' as MountId,
      slug: 'ship-it',
    } satisfies StoreInput;

    expect(input.slug).toBe('ship-it');
  });
});
