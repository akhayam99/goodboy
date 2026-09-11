import { describe, expect, it } from 'vitest';
import {
  PR_GROUP_PRESENTATION,
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from './pullRequestPresentation';
import { stateDescription } from './utils/statePresentation';

const STATES = Object.keys(
  PULL_REQUEST_PRESENTATION,
) as ReadonlyArray<PullRequestPresentationState>;

describe('pull request presentation', () => {
  it('keeps a merged pull request distinct from a closed one on every axis', () => {
    const merged = PULL_REQUEST_PRESENTATION.merged;
    const closed = PULL_REQUEST_PRESENTATION.closed;

    expect(merged.label).not.toBe(closed.label);
    expect(merged.reason).not.toBe(closed.reason);
    expect(merged.tone).not.toBe(closed.tone);
    expect(merged.icon).not.toBe(closed.icon);
  });

  it('keeps an approval distinct from a state the user must repair', () => {
    expect(PULL_REQUEST_PRESENTATION.approved.tone).toBe('success');
    expect(PULL_REQUEST_PRESENTATION.closed.tone).toBe('danger');
    expect(PULL_REQUEST_PRESENTATION.approved.icon).not.toBe(PULL_REQUEST_PRESENTATION.closed.icon);
  });

  it('gives every state a label and a reason, so colour is never the only carrier', () => {
    for (const state of STATES) {
      const presentation = PULL_REQUEST_PRESENTATION[state];
      expect(presentation.label.length, state).toBeGreaterThan(0);
      expect(presentation.reason.length, state).toBeGreaterThan(0);
    }
  });

  it('never lets two states share both an icon and a tone', () => {
    const seen = new Map<string, PullRequestPresentationState>();
    for (const state of STATES) {
      const presentation = PULL_REQUEST_PRESENTATION[state];
      const key = `${presentation.icon.displayName ?? presentation.icon.name}:${presentation.tone}`;
      const clash = seen.get(key);
      expect(clash, `${state} and ${clash} read identically`).toBeUndefined();
      seen.set(key, state);
    }
  });

  it('describes a pull request with its number, its state and why it is there', () => {
    expect(
      stateDescription({ presentation: PULL_REQUEST_PRESENTATION.closed, subject: 'PR #9' }),
    ).toBe('PR #9 closed, closed without being merged');
  });

  it('labels every pull request group, including the merge queue', () => {
    expect(PR_GROUP_PRESENTATION.queued.label).toBe('queued');
    expect(PR_GROUP_PRESENTATION.merged.tone).not.toBe(PR_GROUP_PRESENTATION.closed.tone);
    for (const presentation of Object.values(PR_GROUP_PRESENTATION)) {
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.reason.length).toBeGreaterThan(0);
    }
  });
});
