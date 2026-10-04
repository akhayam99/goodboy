// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { taskIdentityKey } from './taskIdentityKey';

const PAYMENTS = 'project-payments-api' as ProjectId;
const STOREFRONT = 'project-storefront-web' as ProjectId;

describe('taskIdentityKey', () => {
  it('tells apart the same provider id in two projects', () => {
    const payments = taskIdentityKey({
      task: { provider: 'github', externalId: '42', projectId: PAYMENTS },
    });
    const storefront = taskIdentityKey({
      task: { provider: 'github', externalId: '42', projectId: STOREFRONT },
    });

    expect(payments).not.toBe(storefront);
  });

  it('keeps a task without a project apart from the same id in a project', () => {
    expect(taskIdentityKey({ task: { provider: 'github', externalId: '42' } })).not.toBe(
      taskIdentityKey({ task: { provider: 'github', externalId: '42', projectId: PAYMENTS } }),
    );
  });
});
