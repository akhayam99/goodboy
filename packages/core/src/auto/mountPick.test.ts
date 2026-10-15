import { describe, expect, it } from 'vitest';
import { pickAutoMount, type PickableMount } from './mountPick';

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

const ledger = mount({ id: 'mount-ledger' });
const notify = mount({ id: 'mount-notify', mountName: 'notify-relay', branch: 'ak/notify' });

describe('choosing the mount of a delegation', () => {
  it('takes the mount a writer names by id', () => {
    expect(
      pickAutoMount({
        role: 'implementer',
        requested: 'mount-notify',
        mounts: [ledger, notify],
        primaryMountId: 'mount-ledger',
      }),
    ).toMatchObject({ kind: 'picked', mount: { id: 'mount-notify' }, source: 'named' });
  });

  it('refuses a writer that names no mount, even with a single mount, and lists the choices', () => {
    const outcome = pickAutoMount({
      role: 'implementer',
      requested: null,
      mounts: [ledger],
      primaryMountId: 'mount-ledger',
    });
    expect(outcome).toMatchObject({ kind: 'refused', code: 'mount_missing' });
    if (outcome.kind === 'refused') {
      expect(outcome.message).toContain('mount-ledger');
      expect(outcome.allowed.map((entry) => entry.id)).toEqual(['mount-ledger']);
    }
  });

  it('starts a reader without a mount on the primary mount of the tree', () => {
    expect(
      pickAutoMount({
        role: 'scout',
        requested: null,
        mounts: [ledger, notify],
        primaryMountId: 'mount-notify',
      }),
    ).toMatchObject({ kind: 'picked', mount: { id: 'mount-notify' }, source: 'primary' });
  });

  it('refuses a reader when the tree has no usable primary mount', () => {
    expect(
      pickAutoMount({ role: 'scout', requested: null, mounts: [ledger], primaryMountId: null }),
    ).toMatchObject({ kind: 'refused', code: 'mount_missing' });
    expect(
      pickAutoMount({
        role: 'scout',
        requested: null,
        mounts: [mount({ id: 'mount-ledger', isAttached: false })],
        primaryMountId: 'mount-ledger',
      }),
    ).toMatchObject({ kind: 'refused', code: 'mount_missing' });
  });

  it('refuses a mount that vanished, never writes on another one', () => {
    const outcome = pickAutoMount({
      role: 'implementer',
      requested: 'mount-gone',
      mounts: [ledger, notify],
      primaryMountId: 'mount-ledger',
    });
    expect(outcome).toMatchObject({ kind: 'refused', code: 'mount_missing' });
  });

  it('refuses a mount whose folder is gone', () => {
    const outcome = pickAutoMount({
      role: 'implementer',
      requested: 'mount-ledger',
      mounts: [mount({ id: 'mount-ledger', diskState: 'missing' })],
      primaryMountId: 'mount-ledger',
    });
    expect(outcome).toMatchObject({ kind: 'refused', code: 'mount_missing' });
  });

  it('finds a mount by its name and refuses a name two mounts share', () => {
    expect(
      pickAutoMount({
        role: 'tester',
        requested: 'Notify-Relay',
        mounts: [ledger, notify],
        primaryMountId: null,
      }),
    ).toMatchObject({ kind: 'picked', mount: { id: 'mount-notify' } });
    const twin = mount({ id: 'mount-ledger-2' });
    expect(
      pickAutoMount({
        role: 'tester',
        requested: 'ledger-core',
        mounts: [ledger, twin],
        primaryMountId: null,
      }),
    ).toMatchObject({ kind: 'refused', code: 'mount_ambiguous' });
  });
});
