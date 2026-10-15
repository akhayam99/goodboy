import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { checkTargetOf } from './checkTargetOf';

const sessionId = aSession().id;
const MOUNT_A: MountId = JSON.parse(JSON.stringify('mount-ledger-core'));
const MOUNT_B: MountId = JSON.parse(JSON.stringify('mount-payments-api'));
const MOUNT_C: MountId = JSON.parse(JSON.stringify('mount-notify-relay'));
const URL_A = 'https://ci.example.test/northwind/runs/101';
const URL_B = 'https://ci.example.test/northwind/runs/202';

const analystOf = ({ ordinal, url }: { readonly ordinal: number; readonly url: string }) =>
  anAgent({
    sessionId,
    ordinal,
    status: 'completed',
    sourceKind: 'failed_check',
    sourceCommentUrl: url,
  });

const stateOf = () => ({
  sessionPhaseRuns: {
    [sessionId]: [analystOf({ ordinal: 1, url: URL_A }), analystOf({ ordinal: 2, url: URL_B })],
  },
  transcripts: {},
  mountGithub: {
    [MOUNT_A]: { mountId: MOUNT_A, prs: [], detail: { checks: [{ detailsUrl: URL_A }] } },
    [MOUNT_B]: { mountId: MOUNT_B, prs: [{ url: URL_B }], detail: null },
  },
});

type TargetParams = {
  readonly mountId: MountId;
};

const targetOf = ({ mountId }: TargetParams) =>
  checkTargetOf({
    state: stateOf(),
    sessionId,
    mountId,
    failingUrl: null,
    failingName: null,
  });

describe('checkTargetOf', () => {
  it('keeps only analysts whose check belongs to the mount', () => {
    expect(targetOf({ mountId: MOUNT_A })).toEqual({ url: URL_A, name: null });
    expect(targetOf({ mountId: MOUNT_B })).toEqual({ url: URL_B, name: null });
  });

  it('reads no target when no analyst belongs to the mount', () => {
    expect(targetOf({ mountId: MOUNT_C })).toBeNull();
  });
});
