// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const flags = vi.hoisted(() => ({ isPrAvailable: false }));

vi.mock('./branchTabs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./branchTabs')>();
  return {
    ...original,
    isBranchTabAvailable: (tab: BranchTab) =>
      tab === 'pr' ? flags.isPrAvailable : original.isBranchTabAvailable(tab),
  };
});

import { useAppStore } from '../../store';
import { canonicalLocation } from '../../store/slices/navigation/canonicalLocation';
import { locationKey } from '../../store/slices/navigation/locationKey';
import { branchPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { BranchTab, Place } from '../../store/slices/navigation/types';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { BRANCH_TAB_REGISTRY, branchTabsOf, type BranchTabRegistry } from './branchTabs';

const SESSION = 'session-ledger-core' as SessionId;

const SCOPE = { hasPullRequest: true, provider: 'github' } as const;

const prFirst: BranchTabRegistry = {
  ...BRANCH_TAB_REGISTRY,
  pr: { ...BRANCH_TAB_REGISTRY.pr, isAvailable: true },
};

const tabOf = (place: Place): BranchTab | null =>
  place.at === 'session' && place.view.target?.kind === 'branch' ? place.view.target.tab : null;

const landed = (request: Place, pullRequestMode?: 'write_review'): BranchTab | null => {
  const state = {
    ...useAppStore.getInitialState(),
    ...(pullRequestMode !== undefined && { pullRequestModes: { [SESSION]: pullRequestMode } }),
  };
  return tabOf(canonicalLocation({ state, request }).place);
};

beforeEach(() => {
  flags.isPrAvailable = false;
});

describe('the Branch tab registry', () => {
  it('shows the four tabs in order while the pull request tab is unavailable', () => {
    expect(branchTabsOf(SCOPE).map((tab) => tab.id)).toEqual([
      'comments',
      'files',
      'commits',
      'checks',
    ]);
    expect(BRANCH_TAB_REGISTRY.pr.isAvailable).toBe(false);
  });

  it('puts the pull request first once it is available', () => {
    expect(branchTabsOf(SCOPE, prFirst).map((tab) => tab.id)).toEqual([
      'pr',
      'comments',
      'files',
      'commits',
      'checks',
    ]);
    expect(branchTabsOf(SCOPE, prFirst)[0]?.label).toBe('Pull request');
  });

  it('names each tab by the label of its shortcut', () => {
    for (const tab of Object.values(BRANCH_TAB_REGISTRY)) {
      if (tab.shortcut !== null) {
        expect(SHORTCUTS[tab.shortcut].label).toBe(tab.label);
      }
    }
  });

  it('prints each tab as the last segment of the Branch address', () => {
    for (const tab of Object.values(BRANCH_TAB_REGISTRY)) {
      expect(locationKey({ place: branchPlace({ sessionId: SESSION, tab: tab.id }) })).toBe(
        `s/${SESSION}/branch/${tab.address}`,
      );
    }
  });
});

describe('the pull request tab while it is unavailable', () => {
  it('lands a pr address on Comments', () => {
    expect(landed(branchPlace({ sessionId: SESSION, tab: 'pr' }))).toBe('comments');
  });

  it('lands the pull request page request on Comments, or Files while writing a review', () => {
    expect(landed(sessionPlace({ sessionId: SESSION, lens: 'pr' }))).toBe('comments');
    expect(landed(sessionPlace({ sessionId: SESSION, lens: 'pr' }), 'write_review')).toBe('files');
  });

  it('leaves the other tabs alone', () => {
    for (const tab of ['comments', 'files', 'commits', 'checks'] as const) {
      expect(landed(branchPlace({ sessionId: SESSION, tab }))).toBe(tab);
    }
  });
});

describe('the pull request tab once it is available', () => {
  it('keeps a pr address and maps the pull request page request to it', () => {
    flags.isPrAvailable = true;
    expect(landed(branchPlace({ sessionId: SESSION, tab: 'pr' }))).toBe('pr');
    expect(landed(sessionPlace({ sessionId: SESSION, lens: 'pr' }))).toBe('pr');
    expect(landed(sessionPlace({ sessionId: SESSION, lens: 'pr' }), 'write_review')).toBe('files');
  });
});
