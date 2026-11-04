import { describe, expect, it } from 'vitest';
import type { PickableMount } from './mountPick';
import { buildMountsLine } from './mountsLine';

const mount = (overrides: Partial<PickableMount> & { readonly id: string }): PickableMount => ({
  mountName: 'ledger-core',
  branch: 'ak/ledger',
  projectId: 'project-ledger-core',
  worktreePath: '/work/ledger-core',
  revision: 3,
  isAttached: true,
  diskState: 'present',
  ...overrides,
});

describe('the mounts line of a delivery', () => {
  it('lists the one usable mount with its id, project and branch', () => {
    expect(buildMountsLine({ mounts: [mount({ id: 'mount-ledger' })] })).toBe(
      'MOUNTS: mount-ledger (ledger-core, branch ak/ledger).',
    );
  });

  it('lists every usable mount and leaves out the detached and missing ones', () => {
    const line = buildMountsLine({
      mounts: [
        mount({ id: 'mount-ledger' }),
        mount({ id: 'mount-notify', mountName: 'notify-relay', branch: 'ak/notify' }),
        mount({ id: 'mount-gone', diskState: 'missing' }),
        mount({ id: 'mount-detached', isAttached: false }),
      ],
    });

    expect(line).toBe(
      'MOUNTS: mount-ledger (ledger-core, branch ak/ledger); mount-notify (notify-relay, branch ak/notify).',
    );
  });

  it('states the fact and the way forward when no mount can be used, never a prohibition', () => {
    const lines = [
      buildMountsLine({ mounts: [] }),
      buildMountsLine({ mounts: [mount({ id: 'mount-gone', worktreePath: null })] }),
    ];

    for (const line of lines) {
      expect(line).toContain('MOUNTS: none attached yet.');
      expect(line).toContain('delegate a role that changes files as usual');
      expect(line).not.toMatch(/cannot|can not|no agent/i);
    }
  });
});
