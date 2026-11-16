import { describe, expect, it } from 'vitest';
import { getAgentById } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_ROOT,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '@goodboy/db/test-helpers/auto-seeds';
import { aDelegation } from '../../../features/auto/testing/autoViewFixtures';
import { createAutoChild } from './createAutoChild';

type TargetParams = {
  readonly target: Readonly<Record<string, unknown>>;
};

const childOn = async ({ target }: TargetParams) => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  const delegation = {
    ...aDelegation({ key: 'fixer', role: 'implementer', state: 'running' }),
    target,
  };
  await createAutoChild({
    db,
    delegation,
    sessionId: AUTO_SEED_SESSION,
    parentAgentId: AUTO_SEED_ROOT,
    name: 'Implementer',
    kind: 'implementer',
  });
  return getAgentById(db, delegation.childAgentId);
};

describe('createAutoChild', () => {
  it('records the mount the Lead sent the child to', async () => {
    const child = await childOn({ target: { mountId: 'mount-ledger-core' } });

    expect(child?.mountId).toBe('mount-ledger-core');
    expect(child?.parentAgentId).toBe(AUTO_SEED_ROOT);
  });

  it('records no mount when the target names a mount that is gone', async () => {
    const child = await childOn({ target: { mountId: 'mount-gone' } });

    expect(child).not.toBeNull();
    expect(child?.mountId).toBeUndefined();
  });

  it('records no mount when the target names none', async () => {
    const child = await childOn({ target: { mountName: 'ledger-core' } });

    expect(child?.mountId).toBeUndefined();
  });
});
