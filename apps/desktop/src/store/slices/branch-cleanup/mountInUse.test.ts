// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { isMountInUse } from './mountInUse';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const NOTIFY = brandId<MountId>({ value: 'mount-notify-relay' });

type Phase = 'waiting' | 'finished';

const stateOf = ({ phase }: { readonly phase: Phase }) => ({
  sessionPhaseRuns: {},
  agentTurnDestination: {},
  autoTreeViews: {
    [SESSION]: [
      {
        tree: { phase, stopState: 'none' as const, primaryMountId: LEDGER },
        delegations: [{ target: { mountId: NOTIFY } }],
      },
    ],
  },
});

describe('a mount a live Auto tree holds', () => {
  it('is in use while the tree is not over', () => {
    const state = stateOf({ phase: 'waiting' });

    expect(isMountInUse({ state: state, sessionId: SESSION, mountId: LEDGER })).toBe(true);
    expect(isMountInUse({ state: state, sessionId: SESSION, mountId: NOTIFY })).toBe(true);
  });

  it('is free once the tree finished', () => {
    const state = stateOf({ phase: 'finished' });

    expect(isMountInUse({ state: state, sessionId: SESSION, mountId: LEDGER })).toBe(false);
  });
});
