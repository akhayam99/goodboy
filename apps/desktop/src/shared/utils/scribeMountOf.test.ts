import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { scribeKickoff } from '../../store/slices/scribe/scribeKickoff';
import { scribeMountOf } from './scribeMountOf';

const LEDGER = { mountId: 'mount-ledger' as MountId, branch: 'fix/ledger-postings' };
const RELAY = { mountId: 'mount-relay' as MountId, branch: 'fix/relay-retries' };

const kickoffFor = (branch: string): string =>
  scribeKickoff({
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
    branch,
    baseBranch: 'main',
    goal: 'Make postings idempotent',
    decisions: '',
    summary: '',
    issues: [],
  });

describe('scribeMountOf', () => {
  it('finds the mount whose branch the kickoff names', () => {
    expect(scribeMountOf({ mounts: [LEDGER, RELAY], kickoff: kickoffFor(RELAY.branch) })).toBe(
      RELAY.mountId,
    );
  });

  it('takes the only mount when the kickoff is gone', () => {
    expect(scribeMountOf({ mounts: [LEDGER], kickoff: null })).toBe(LEDGER.mountId);
  });

  it('gives up rather than guess between two mounts', () => {
    expect(scribeMountOf({ mounts: [LEDGER, RELAY], kickoff: null })).toBeNull();
    expect(scribeMountOf({ mounts: [], kickoff: kickoffFor(LEDGER.branch) })).toBeNull();
  });
});
