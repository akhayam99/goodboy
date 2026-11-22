// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { BranchTab } from '../../store/slices/navigation/types';
import { tabForFactOf, type BranchFact } from './tabForFactOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const MOUNT = 'mount-payments-api';

type TabParams = {
  readonly fact: BranchFact | null;
};

const tabOf = ({ fact }: TabParams): BranchTab | null => {
  const place = tabForFactOf({ sessionId: SESSION, mountId: MOUNT, fact });
  if (place.at !== 'session' || place.view.target?.kind !== 'branch') {
    return null;
  }
  return place.view.target.tab;
};

const CASES: ReadonlyArray<readonly [BranchFact, BranchTab]> = [
  ['checks-failing', 'checks'],
  ['checks-running', 'checks'],
  ['fix-checks', 'checks'],
  ['rerun-check', 'checks'],
  ['changes-requested', 'comments'],
  ['resolve-threads', 'comments'],
  ['check-changes', 'files'],
  ['conflicts', 'commits'],
  ['rebasing', 'commits'],
  ['not-pushed', 'commits'],
  ['push-branch', 'commits'],
  ['in-review', 'pr'],
  ['approved', 'pr'],
  ['merge-pr', 'pr'],
  ['open-pr', 'pr'],
];

describe('tabForFactOf', () => {
  it.each(CASES)('opens the tab that %s names', (fact, tab) => {
    expect(tabOf({ fact })).toBe(tab);
  });

  it('opens Conversation when no fact is named', () => {
    expect(tabOf({ fact: null })).toBe('pr');
  });

  it('addresses the branch by its mount, never by a path', () => {
    const place = tabForFactOf({ sessionId: SESSION, mountId: MOUNT, fact: 'fix-checks' });

    expect(place).toMatchObject({
      at: 'session',
      sessionId: SESSION,
      view: { lens: 'branch', target: { kind: 'branch', mountId: MOUNT, mountPath: null } },
    });
  });
});
