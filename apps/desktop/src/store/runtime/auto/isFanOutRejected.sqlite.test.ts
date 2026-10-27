import { describe, expect, it } from 'vitest';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import { batchInput, childInput, makeAutoWorld } from './testing/autoWorld';
import { isFanOutRejected } from './isFanOutRejected';

const inTree = async () => {
  const world = await makeAutoWorld({ agentIds: ['agent-scout', 'agent-loose'] });
  await world.scheduler.admit(
    batchInput({ children: [childInput({ key: 'scout', agentId: 'agent-scout' })] }),
  );
  return world;
};

describe('a split asked for inside an Auto tree', () => {
  it('is turned down for the child of a delegation', async () => {
    const world = await inTree();

    expect(await isFanOutRejected({ db: world.db, agentId: 'agent-scout', areaCount: 3 })).toBe(
      true,
    );
  });

  it('is left alone for an agent no delegation started', async () => {
    const world = await inTree();

    expect(await isFanOutRejected({ db: world.db, agentId: 'agent-loose', areaCount: 3 })).toBe(
      false,
    );
    expect(await isFanOutRejected({ db: world.db, agentId: AUTO_SEED_ROOT, areaCount: 3 })).toBe(
      false,
    );
  });

  it('is no split at all below two areas, so nothing is looked up', async () => {
    const world = await inTree();

    expect(await isFanOutRejected({ db: world.db, agentId: 'agent-scout', areaCount: 1 })).toBe(
      false,
    );
    expect(await isFanOutRejected({ db: world.db, agentId: 'agent-scout', areaCount: 0 })).toBe(
      false,
    );
  });
});
