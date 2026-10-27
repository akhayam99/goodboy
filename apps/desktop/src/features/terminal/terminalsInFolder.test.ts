import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import { terminalsInFolder } from './terminalsInFolder';

const FOLDER = '/repos/payments-api/.goodboy/worktrees/retry-webhook';
const MOUNT = brandId<MountId>({ value: 'mount-1' });

const tab = (patch: Partial<TerminalTab>): TerminalTab => ({
  id: brandId<TerminalTabId>({ value: 'terminal-1' }),
  owner: { kind: 'session', sessionId: brandId<SessionId>({ value: 'session-1' }) },
  title: 'shell',
  cwd: FOLDER,
  status: 'running',
  createdAt: 1,
  ...patch,
});

const find = (tabs: ReadonlyArray<TerminalTab>, mountId: MountId | null = null) =>
  terminalsInFolder({ tabs: { 'session-1': tabs }, path: FOLDER, mountId });

describe('terminalsInFolder', () => {
  it('finds a live shell by its folder, with or without a trailing slash', () => {
    expect(find([tab({})])).toHaveLength(1);
    expect(
      terminalsInFolder({ tabs: { s: [tab({})] }, path: `${FOLDER}/`, mountId: null }),
    ).toHaveLength(1);
  });

  it('finds a shell that moved into a subfolder and a shell tied to the mount', () => {
    expect(find([tab({ cwd: `${FOLDER}/src` })])).toHaveLength(1);
    expect(find([tab({ cwd: '/elsewhere', mountId: MOUNT })], MOUNT)).toHaveLength(1);
  });

  it('skips exited shells, other folders and look-alike names', () => {
    expect(find([tab({ status: 'exited' })])).toHaveLength(0);
    expect(find([tab({ cwd: '/repos/ledger-core' })])).toHaveLength(0);
    expect(find([tab({ cwd: `${FOLDER}-two` })])).toHaveLength(0);
    expect(find([tab({ cwd: null })])).toHaveLength(0);
  });

  it('counts a shell waiting for attention as live', () => {
    expect(find([tab({ status: 'attention' })])).toHaveLength(1);
  });
});
