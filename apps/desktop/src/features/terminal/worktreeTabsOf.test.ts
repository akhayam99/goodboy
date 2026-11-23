import { describe, expect, it } from 'vitest';
import type { MountId, SessionProjectMount } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import {
  ledgerCore,
  mountOf,
  notifyRelay,
  paymentsApi,
  sessionOf,
} from '../workspace/testing/sessionColumn';
import { worktreeTabsOf } from './worktreeTabsOf';

const session = sessionOf({ goal: 'Retry the webhook' });

const projects = [paymentsApi, ledgerCore, notifyRelay];

const payments = mountOf({ session, project: paymentsApi });

const relay = mountOf({ session, project: notifyRelay });

const secondPayments: SessionProjectMount = {
  ...payments,
  mountId: brandedId<MountId>({ value: `${payments.mountId}-2` }),
  worktreePath: `${payments.worktreePath}-2`,
  branch: 'goodboy/retry-window',
};

describe('one terminal tab per track', () => {
  it('gives each mounted worktree one tab named after its project', () => {
    const tabs = worktreeTabsOf({ mounts: [payments, relay], projects });

    expect(tabs.map((tab) => [tab.label, tab.path])).toEqual([
      ['payments-api', payments.worktreePath],
      ['notify-relay', relay.worktreePath],
    ]);
  });

  it('adds the branch when two tracks share a project', () => {
    const tabs = worktreeTabsOf({ mounts: [payments, secondPayments], projects });

    expect(tabs.map((tab) => tab.label)).toEqual([
      `payments-api · ${payments.branch}`,
      'payments-api · goodboy/retry-window',
    ]);
  });

  it('leaves out a closed track and one whose folder is gone', () => {
    const tabs = worktreeTabsOf({
      mounts: [
        payments,
        { ...relay, isAttached: false },
        { ...secondPayments, diskState: 'missing' },
      ],
      projects,
    });

    expect(tabs.map((tab) => tab.mountId)).toEqual([payments.mountId]);
  });

  it('keeps one tab when a track is listed twice', () => {
    const tabs = worktreeTabsOf({ mounts: [payments, payments], projects });

    expect(tabs).toHaveLength(1);
  });
});
